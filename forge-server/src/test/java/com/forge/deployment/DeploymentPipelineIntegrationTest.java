package com.forge.deployment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.runtime.RunningInstance;
import com.forge.runtime.RuntimeProvider;
import com.forge.source.CommitInfo;
import com.forge.source.SourceCodeProvider;
import com.forge.support.AbstractIntegrationTest;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * The whole deployment pipeline, end to end: HTTP API → job queue → build → rollout → state machine
 * → audit → agent. Only the edges that need the outside world (git, Docker, HTTP probes) are
 * replaced by mocks.
 */
class DeploymentPipelineIntegrationTest extends AbstractIntegrationTest {

  static final String SHA = "3f2a9c1b0d4e5f60718293a4b5c6d7e8f9012345";

  @MockitoBean SourceCodeProvider source;
  @MockitoBean BuildService builds;
  @MockitoBean RuntimeProvider runtime;
  @MockitoBean HealthProbe health;

  @Autowired PostgresJobQueue queue;
  @Autowired JobRunner runner;
  @Autowired LogSink logSink;

  private final AtomicInteger containers = new AtomicInteger();
  private String token;
  private String projectId;

  @BeforeEach
  void setUp() throws Exception {
    when(source.resolveHead(any(), anyString(), any())).thenReturn(SHA);
    when(builds.build(any()))
        .thenAnswer(
            call -> {
              BuildRequest request = call.getArgument(0);
              return new BuildResult(
                  "localhost:5001/forge/"
                      + request.projectSlug()
                      + ":"
                      + request.commitSha().substring(0, 12),
                  BuildType.NODE,
                  new CommitInfo(request.commitSha(), "feat: say hello"));
            });
    when(runtime.start(any()))
        .thenAnswer(
            call ->
                new RunningInstance(
                    "container-" + containers.incrementAndGet(), URI.create("http://127.0.0.1:1")));
    when(runtime.isRunning(anyString())).thenReturn(true);
    when(runtime.exitDescription(anyString())).thenReturn("exited with code 1");
    healthy(true);

    token = signUp("dev");
    projectId = createProject();
  }

  @Test
  void deployGoesLiveThroughEveryStateAndIsAudited() throws Exception {
    String id = deploy().get("id").asText();

    drainJobs();

    JsonNode deployment = getDeployment(id);
    assertThat(deployment.get("status").asText()).isEqualTo("LIVE");
    assertThat(deployment.get("commitMessage").asText()).isEqualTo("feat: say hello");
    assertThat(deployment.get("timeline").findValuesAsText("to"))
        .containsExactly("QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECKING", "LIVE");
    assertThat(project().get("liveDeploymentId").asText()).isEqualTo(id);
    assertThat(logLines(id)).anyMatch(line -> line.contains("Live at http://hello-app.localhost"));
  }

  @Test
  void newVersionReplacesTheOldContainerWithoutDowntime() throws Exception {
    String first = deploy().get("id").asText();
    drainJobs();
    String second = deploy().get("id").asText();
    drainJobs();

    assertThat(getDeployment(first).get("status").asText()).isEqualTo("SUPERSEDED");
    assertThat(getDeployment(second).get("status").asText()).isEqualTo("LIVE");
    verify(runtime).stop("container-1"); // old version stopped only after the new one was live
  }

  @Test
  void unhealthyNewVersionFailsAndTheOldOneKeepsServing() throws Exception {
    String good = deploy().get("id").asText();
    drainJobs();

    healthy(false);
    when(runtime.recentOutput(anyString(), anyInt()))
        .thenReturn(List.of("Server listening on port 3000"));
    String bad = deploy().get("id").asText();
    drainJobs();

    JsonNode failed = getDeployment(bad);
    assertThat(failed.get("status").asText()).isEqualTo("FAILED");
    assertThat(failed.get("failureReason").asText()).isEqualTo("UNHEALTHY");
    assertThat(getDeployment(good).get("status").asText()).isEqualTo("LIVE");
    verify(runtime, never()).stop("container-1");
    verify(runtime).stop("container-2");

    // the agent investigates asynchronously and pins the cause from the app's own output
    await()
        .atMost(Duration.ofSeconds(10))
        .untilAsserted(
            () ->
                mvc.perform(
                        get("/api/v1/deployments/" + bad + "/insight")
                            .header("Authorization", bearer(token)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.category").value("PORT_MISMATCH"))
                    .andExpect(jsonPath("$.engine").value("rules")));
  }

  @Test
  void buildFailureIsRecordedAndDiagnosed() throws Exception {
    when(builds.build(any()))
        .thenAnswer(
            call -> {
              BuildRequest request = call.getArgument(0);
              logSink.append(
                  request.deploymentId(),
                  LogSource.BUILD,
                  "[ERROR] App.java:[3,1] cannot find symbol");
              throw new BuildFailedException(
                  BuildFailedException.Reason.BUILD_FAILED, "docker build failed");
            });
    String id = deploy().get("id").asText();
    drainJobs();

    JsonNode deployment = getDeployment(id);
    assertThat(deployment.get("status").asText()).isEqualTo("FAILED");
    assertThat(deployment.get("failureReason").asText()).isEqualTo("BUILD_FAILED");
    verify(runtime, never()).start(any());
    await()
        .atMost(Duration.ofSeconds(10))
        .untilAsserted(
            () ->
                mvc.perform(
                        get("/api/v1/deployments/" + id + "/insight")
                            .header("Authorization", bearer(token)))
                    .andExpect(jsonPath("$.category").value("COMPILATION_ERROR")));
  }

  @Test
  void rollbackRedeploysTheOldImageWithoutBuilding() throws Exception {
    String first = deploy().get("id").asText();
    drainJobs();
    deploy();
    drainJobs();

    String rollback =
        read(mvc.perform(
                    post("/api/v1/deployments/" + first + "/rollback")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isAccepted())
                .andReturn()
                .getResponse()
                .getContentAsString())
            .get("id")
            .asText();
    drainJobs();

    JsonNode result = getDeployment(rollback);
    assertThat(result.get("status").asText()).isEqualTo("LIVE");
    assertThat(result.get("trigger").asText()).isEqualTo("ROLLBACK");
    assertThat(result.get("imageRef").asText())
        .isEqualTo(getDeployment(first).get("imageRef").asText());
    assertThat(result.get("timeline").findValuesAsText("to")).doesNotContain("BUILDING");
    verify(builds, org.mockito.Mockito.times(2)).build(any());
  }

  @Test
  void newerRequestSupersedesOneStillWaitingInTheQueue() throws Exception {
    String older = deploy().get("id").asText();
    String newer = deploy().get("id").asText();
    drainJobs();

    assertThat(getDeployment(older).get("status").asText()).isEqualTo("CANCELLED");
    assertThat(getDeployment(newer).get("status").asText()).isEqualTo("LIVE");
    verify(builds, org.mockito.Mockito.times(1)).build(any());
  }

  @Test
  void cancelOnlyWhileNotYetDeploying() throws Exception {
    String id = deploy().get("id").asText();
    mvc.perform(
            post("/api/v1/deployments/" + id + "/cancel").header("Authorization", bearer(token)))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.status").value("CANCELLED"));
    mvc.perform(
            post("/api/v1/deployments/" + id + "/cancel").header("Authorization", bearer(token)))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("NOT_CANCELLABLE"));
    drainJobs();
    verify(builds, never()).build(any());
  }

  @Test
  void databaseAllowsOnlyOneInProgressDeploymentPerProject() throws Exception {
    String a = deploy().get("id").asText();
    jdbc.update("update deployments set status = 'BUILDING' where id = ?::uuid", a);
    jdbc.update(
        "insert into deployments (id, project_id, commit_sha, trigger, status, created_at) values"
            + " (gen_random_uuid(), ?::uuid, ?, 'MANUAL', 'QUEUED', now())",
        projectId,
        SHA);

    org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> jdbc.update("update deployments set status = 'BUILDING' where status = 'QUEUED'"))
        .hasMessageContaining("ux_deployments_one_active");
  }

  @Test
  void strangersCannotSeeOrTouchDeployments() throws Exception {
    String id = deploy().get("id").asText();
    String stranger = signUp("stranger");
    mvc.perform(get("/api/v1/deployments/" + id).header("Authorization", bearer(stranger)))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/v1/deployments/" + id + "/cancel").header("Authorization", bearer(stranger)))
        .andExpect(status().isNotFound());
  }

  // --- helpers -------------------------------------------------------------------------------

  private void healthy(boolean ok) {
    when(health.awaitHealthy(any(), anyString(), any(), any()))
        .thenReturn(
            new HealthResult(
                ok,
                3,
                Duration.ofSeconds(4),
                ok ? "HTTP 200 from /health" : "process exited (Connection refused)"));
  }

  /** Runs queued jobs synchronously until the queue is empty (what workers do in production). */
  private void drainJobs() {
    Optional<Job> job;
    while ((job = queue.claim("test-worker", Duration.ofMinutes(1))).isPresent()) {
      runner.run(job.get());
    }
  }

  private String createProject() throws Exception {
    String body =
        mvc.perform(
                post("/api/v1/projects")
                    .header("Authorization", bearer(token))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name":"Hello App","repoOwner":"demo","repoName":"hello-node","port":8080,"healthCheckPath":"/health"}
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return read(body).get("id").asText();
  }

  private JsonNode deploy() throws Exception {
    return read(
        mvc.perform(
                post("/api/v1/projects/" + projectId + "/deployments")
                    .header("Authorization", bearer(token)))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.status").value("QUEUED"))
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode getDeployment(String id) throws Exception {
    return read(
        mvc.perform(get("/api/v1/deployments/" + id).header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode project() throws Exception {
    return read(
        mvc.perform(get("/api/v1/projects/" + projectId).header("Authorization", bearer(token)))
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private List<String> logLines(String id) throws Exception {
    return read(mvc.perform(
                get("/api/v1/deployments/" + id + "/logs").header("Authorization", bearer(token)))
            .andReturn()
            .getResponse()
            .getContentAsString())
        .findValuesAsText("line");
  }
}
