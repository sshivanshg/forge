package com.forge.deployment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.forge.build.BuildFailedException;
import com.forge.build.BuildRequest;
import com.forge.build.BuildResult;
import com.forge.build.BuildService;
import com.forge.build.BuildType;
import com.forge.health.HealthProbe;
import com.forge.health.HealthResult;
import com.forge.jobs.Job;
import com.forge.jobs.infrastructure.JobRunner;
import com.forge.jobs.infrastructure.PostgresJobQueue;
import com.forge.runtime.RunningInstance;
import com.forge.runtime.RuntimeProvider;
import com.forge.runtime.TrafficMetrics;
import com.forge.runtime.TrafficSample;
import com.forge.runtime.TrafficSplitter;
import com.forge.source.CommitInfo;
import com.forge.source.SourceCodeProvider;
import com.forge.support.AbstractIntegrationTest;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Dashboard read endpoints: traffic, instances, activity and overview, scoped to the owner. */
class InsightsApiIntegrationTest extends AbstractIntegrationTest {

  static final String SHA = "3f2a9c1b0d4e5f60718293a4b5c6d7e8f9012345";

  @MockitoBean SourceCodeProvider source;
  @MockitoBean BuildService builds;
  @MockitoBean RuntimeProvider runtime;
  @MockitoBean HealthProbe health;
  @MockitoBean TrafficSplitter splitter;
  @MockitoBean TrafficMetrics metrics;

  @Autowired PostgresJobQueue queue;
  @Autowired JobRunner runner;

  private final AtomicInteger containers = new AtomicInteger();
  private String token;

  @BeforeEach
  void setUp() throws Exception {
    when(source.resolveHead(any(), anyString(), any())).thenReturn(SHA);
    when(builds.build(any()))
        .thenAnswer(
            call -> {
              BuildRequest request = call.getArgument(0);
              return new BuildResult(
                  "localhost:5001/forge/" + request.projectSlug() + ":abc",
                  BuildType.NODE,
                  new CommitInfo(request.commitSha(), "feat: say hello"));
            });
    when(runtime.start(any()))
        .thenAnswer(
            call ->
                new RunningInstance(
                    "container-" + containers.incrementAndGet(), URI.create("http://127.0.0.1:1")));
    when(runtime.isRunning(anyString())).thenReturn(true);
    when(health.awaitHealthy(any(), anyString(), any(), any()))
        .thenReturn(new HealthResult(true, 1, Duration.ofSeconds(1), "HTTP 200"));
    token = signUp("dev");
  }

  @Test
  void trafficReportsTheProxyCountersAndZerosWithoutThem() throws Exception {
    String projectId = createProject("Hello App", "hello-node");
    String id = deploy(projectId);
    drainJobs();

    when(metrics.sample(eq("hello-app"), eq(UUID.fromString(id))))
        .thenReturn(Optional.of(new TrafficSample(200, 10, 4.0)));
    JsonNode traffic = getJson("/api/v1/deployments/" + id + "/traffic", token);
    assertThat(traffic.get("deploymentId").asText()).isEqualTo(id);
    assertThat(traffic.get("requests").asLong()).isEqualTo(200);
    assertThat(traffic.get("serverErrors").asLong()).isEqualTo(10);
    assertThat(traffic.get("errorRate").asDouble()).isEqualTo(0.05);
    assertThat(traffic.get("meanLatencyMs").asDouble()).isEqualTo(20.0);
    assertThat(traffic.get("sampledAt").isNull()).isFalse();

    doThrow(new IllegalStateException("down")).when(metrics).sample(anyString(), any());
    JsonNode none = getJson("/api/v1/deployments/" + id + "/traffic", token);
    assertThat(none.get("requests").asLong()).isZero();
    assertThat(none.get("errorRate").asDouble()).isZero();
  }

  @Test
  void instancesListTheRunningReplicasWithTheirShareOfTraffic() throws Exception {
    String projectId = createProject("Hello App", "hello-node");
    String id = deploy(projectId);
    drainJobs();

    JsonNode instances = getJson("/api/v1/projects/" + projectId + "/instances", token);
    assertThat(instances).hasSize(1);
    JsonNode instance = instances.get(0);
    assertThat(instance.get("deploymentId").asText()).isEqualTo(id);
    assertThat(instance.get("replicaIndex").asInt()).isZero();
    assertThat(instance.get("containerId").asText()).startsWith("container-");
    assertThat(instance.get("address").asText()).isEqualTo("http://127.0.0.1:1");
    assertThat(instance.get("state").asText()).isEqualTo("RUNNING");
    assertThat(instance.get("trafficWeight").asInt()).isEqualTo(100);
    assertThat(instance.get("startedAt").isNull()).isFalse();
  }

  @Test
  void activityAndOverviewCoverAllOfTheCallersProjects() throws Exception {
    String hello = createProject("Hello App", "hello-node");
    String broken = createProject("Broken App", "broken-app");
    deploy(hello);
    drainJobs();
    doThrow(
            new BuildFailedException(
                BuildFailedException.Reason.BUILD_FAILED, "npm ERR! missing script"))
        .when(builds)
        .build(any());
    deploy(broken);
    drainJobs();

    JsonNode activity = getJson("/api/v1/activity?limit=20", token);
    assertThat(activity).hasSize(2);
    assertThat(activity.get(0).get("projectName").asText()).isEqualTo("Broken App");
    assertThat(activity.get(0).get("projectSlug").asText()).isEqualTo("broken-app");
    assertThat(activity.get(0).get("projectId").asText()).isEqualTo(broken);
    assertThat(activity.get(0).get("status").asText()).isEqualTo("FAILED");
    assertThat(activity.get(1).get("status").asText()).isEqualTo("LIVE");
    assertThat(getJson("/api/v1/activity?limit=1", token)).hasSize(1);
    assertThat(getJson("/api/v1/activity?limit=500", token)).hasSize(2); // clamped to 100

    JsonNode overview = getJson("/api/v1/overview", token);
    assertThat(overview.get("projects").asInt()).isEqualTo(2);
    assertThat(overview.get("liveProjects").asInt()).isEqualTo(1);
    assertThat(overview.get("deploys7d").asLong()).isEqualTo(2);
    assertThat(overview.get("failed7d").asLong()).isEqualTo(1);
    assertThat(overview.get("successRate7d").asDouble()).isEqualTo(0.5);
    assertThat(overview.get("medianDeployMs7d").isNumber()).isTrue();
    JsonNode days = overview.get("deploysByDay");
    assertThat(days).hasSize(14);
    JsonNode last = days.get(13);
    assertThat(last.get("date").asText()).isEqualTo(LocalDate.now(ZoneOffset.UTC).toString());
    assertThat(last.get("succeeded").asLong()).isEqualTo(1);
    assertThat(last.get("failed").asLong()).isEqualTo(1);
    assertThat(days.get(0).get("succeeded").asLong()).isZero();

    String stranger = signUp("stranger");
    assertThat(getJson("/api/v1/activity", stranger)).isEmpty();
    JsonNode empty = getJson("/api/v1/overview", stranger);
    assertThat(empty.get("projects").asInt()).isZero();
    assertThat(empty.get("successRate7d").isNull()).isTrue();
    assertThat(empty.get("medianDeployMs7d").isNull()).isTrue();
    assertThat(empty.get("deploysByDay")).hasSize(14);
  }

  @Test
  void strangersGetNotFound() throws Exception {
    String projectId = createProject("Hello App", "hello-node");
    String id = deploy(projectId);
    String stranger = signUp("stranger");
    mvc.perform(
            get("/api/v1/deployments/" + id + "/traffic").header("Authorization", bearer(stranger)))
        .andExpect(status().isNotFound());
    mvc.perform(
            get("/api/v1/projects/" + projectId + "/instances")
                .header("Authorization", bearer(stranger)))
        .andExpect(status().isNotFound());
  }

  // --- helpers -------------------------------------------------------------------------------

  private JsonNode getJson(String url, String bearerToken) throws Exception {
    return read(
        mvc.perform(get(url).header("Authorization", bearer(bearerToken)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private void drainJobs() {
    Optional<Job> job;
    while ((job = queue.claim("test-worker", Duration.ofMinutes(1))).isPresent()) {
      runner.run(job.get());
    }
  }

  private String createProject(String name, String repo) throws Exception {
    String body =
        mvc.perform(
                post("/api/v1/projects")
                    .header("Authorization", bearer(token))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name":"%s","repoOwner":"demo","repoName":"%s","port":8080,"healthCheckPath":"/health"}
                        """
                            .formatted(name, repo)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return read(body).get("id").asText();
  }

  private String deploy(String projectId) throws Exception {
    return read(mvc.perform(
                post("/api/v1/projects/" + projectId + "/deployments")
                    .header("Authorization", bearer(token)))
            .andExpect(status().isAccepted())
            .andReturn()
            .getResponse()
            .getContentAsString())
        .get("id")
        .asText();
  }
}
