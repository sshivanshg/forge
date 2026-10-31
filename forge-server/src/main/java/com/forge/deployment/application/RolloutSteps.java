package com.forge.deployment.application;

import com.forge.deployment.FailureReason;
import com.forge.deployment.domain.RuntimeInstanceRecord;
import com.forge.health.HealthProbe;
import com.forge.health.HealthResult;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.ContainerSpec;
import com.forge.runtime.RunningInstance;
import com.forge.runtime.RuntimeProvider;
import com.forge.shared.config.AppUrls;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The building blocks every {@link RolloutStrategy} shares: start the new version's replicas and
 * health-check them, retire the previous version, and report progress in the deploy log. The
 * strategies differ only in how they move traffic in between (composition, not inheritance).
 */
@Component
class RolloutSteps {

  private static final int CRASH_OUTPUT_LINES = 60;

  private final RuntimeProvider runtime;
  private final HealthProbe health;
  private final DeploymentTransitions transitions;
  private final LogSink logs;
  private final AppUrls appUrls;
  private final DeploymentProperties properties;

  RolloutSteps(
      RuntimeProvider runtime,
      HealthProbe health,
      DeploymentTransitions transitions,
      LogSink logs,
      AppUrls appUrls,
      DeploymentProperties properties) {
    this.runtime = runtime;
    this.health = health;
    this.transitions = transitions;
    this.logs = logs;
    this.appUrls = appUrls;
    this.properties = properties;
  }

  /**
   * Starts one instance per replica and health-checks each directly, before it is trusted with
   * traffic. If any replica is unhealthy, all of them are removed, the deployment is marked FAILED
   * and the result is empty; the live version was never touched.
   */
  Optional<List<RunningInstance>> startHealthy(RolloutContext context) {
    UUID id = context.deploymentId();
    ProjectSnapshot project = context.project();

    // A retried job may have left containers behind: never run two sets of the same version.
    transitions.instancesOf(id).forEach(previous -> runtime.stop(previous.externalId()));

    int replicas = Math.max(1, project.replicas());
    say(
        id,
        "Starting "
            + (replicas == 1 ? "container" : replicas + " replicas")
            + " from "
            + context.imageRef());
    List<RunningInstance> started = new ArrayList<>();
    for (int replica = 0; replica < replicas; replica++) {
      RunningInstance instance = runtime.start(containerSpec(context, replica));
      transitions.recordInstance(id, replica, instance);
      started.add(instance);
    }
    transitions.beginHealthCheck(id);

    say(
        id,
        "Waiting for "
            + project.healthCheckPath()
            + " to respond (up to "
            + properties.healthTimeout().toSeconds()
            + "s)");
    int attempts = 0;
    for (RunningInstance instance : started) {
      ListeningPortWatch port =
          new ListeningPortWatch(runtime, instance.instanceId(), project.port());
      HealthResult result =
          health.awaitHealthy(
              instance.probeUrl(),
              project.healthCheckPath(),
              properties.healthTimeout(),
              () -> runtime.isRunning(instance.instanceId()) && port.portLooksRight());
      if (!result.healthy()) {
        HealthResult reason =
            port.problem()
                .map(p -> new HealthResult(false, result.attempts(), result.elapsed(), p))
                .orElse(result);
        reject(id, started, instance, reason);
        return Optional.empty();
      }
      attempts += result.attempts();
      if (started.size() == 1) {
        say(id, "Healthy after " + result.attempts() + " check(s): " + result.detail());
      }
    }
    if (started.size() > 1) {
      say(id, "All " + started.size() + " replicas healthy (" + attempts + " checks)");
    }
    started.forEach(instance -> runtime.promote(instance.instanceId()));
    return Optional.of(List.copyOf(started));
  }

  /** After the new version went live: stop every other version of the project. */
  void retirePreviousVersions(UUID id, ProjectSnapshot project) {
    List<RuntimeInstanceRecord> previous =
        transitions.activeInstances(project.id()).stream()
            .filter(instance -> !instance.deploymentId().equals(id))
            .toList();
    if (previous.isEmpty()) {
      return;
    }
    pause();
    Set<UUID> versions = new LinkedHashSet<>();
    for (RuntimeInstanceRecord old : previous) {
      runtime.stop(old.externalId());
      versions.add(old.deploymentId());
    }
    versions.forEach(transitions::markInstancesStopped);
    say(id, "Stopped the previous version");
  }

  /**
   * Removes the new version's instances after it was rejected, keeping the first one's last output
   * in the deploy log for the diagnosis.
   */
  void removeNewVersion(UUID id, List<RunningInstance> instances, RunningInstance culprit) {
    runtime
        .recentOutput(culprit.instanceId(), CRASH_OUTPUT_LINES)
        .forEach(line -> logs.append(id, LogSource.RUNTIME, line));
    instances.forEach(instance -> runtime.stop(instance.instanceId()));
    transitions.markInstancesStopped(id);
  }

  void announceLive(UUID id, ProjectSnapshot project) {
    say(id, "Live at " + appUrls.urlFor(project.slug()));
  }

  void say(UUID deploymentId, String message) {
    logs.append(deploymentId, LogSource.DEPLOY, "▶ " + message);
  }

  void warn(UUID deploymentId, String message) {
    logs.append(deploymentId, LogSource.SYSTEM, message);
  }

  private void reject(
      UUID id, List<RunningInstance> started, RunningInstance culprit, HealthResult result) {
    String exit = runtime.exitDescription(culprit.instanceId());
    removeNewVersion(id, started, culprit);
    warn(
        id,
        "✖ New version is unhealthy ("
            + result.detail()
            + "). The previous version keeps serving.");
    transitions.fail(id, FailureReason.UNHEALTHY, result.detail() + "; container " + exit);
  }

  private ContainerSpec containerSpec(RolloutContext context, int replica) {
    ProjectSnapshot project = context.project();
    String name =
        "forge-" + project.slug() + "-" + context.deploymentId().toString().substring(0, 8);
    return ContainerSpec.builder()
        .name(replica == 0 ? name : name + "-" + (replica + 1))
        .image(context.imageRef())
        .port(project.port())
        .env("PORT", Integer.toString(project.port()))
        .environment(context.environment())
        .route(project.slug(), appUrls.hostFor(project.slug()))
        .healthPath(project.healthCheckPath())
        .deployment(context.deploymentId(), project.slug())
        .build();
  }

  private void pause() {
    try {
      Thread.sleep(properties.drainDelay());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
