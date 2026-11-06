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
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Zero-downtime blue-green rollout.
 *
 * <ol>
 *   <li>Start the new version ("green") next to the live one ("blue").
 *   <li>Health-check green directly, before trusting it with traffic.
 *   <li>Unhealthy → capture its output, remove it, mark the deployment FAILED. Blue was never
 *       touched, so the site stays up.
 *   <li>Healthy → mark LIVE, wait briefly for the proxy, then stop blue.
 * </ol>
 */
@Component
class BlueGreenRollout implements RolloutStrategy {

  private static final int CRASH_OUTPUT_LINES = 60;

  private final RuntimeProvider runtime;
  private final HealthProbe health;
  private final DeploymentTransitions transitions;
  private final LogSink logs;
  private final AppUrls appUrls;
  private final DeploymentProperties properties;

  BlueGreenRollout(
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

  @Override
  public void rollout(RolloutContext context) {
    UUID id = context.deploymentId();
    ProjectSnapshot project = context.project();

    // A retried job may have left a container behind: never run two greens.
    transitions.instanceOf(id).ifPresent(previous -> runtime.stop(previous.externalId()));

    say(id, "Starting container from " + context.imageRef());
    RunningInstance green = runtime.start(containerSpec(context));
    transitions.recordInstance(id, green);
    transitions.beginHealthCheck(id);

    say(
        id,
        "Waiting for "
            + project.healthCheckPath()
            + " to respond (up to "
            + properties.healthTimeout().toSeconds()
            + "s)");
    ListeningPortWatch port = new ListeningPortWatch(runtime, green.instanceId(), project.port());
    HealthResult result =
        health.awaitHealthy(
            green.probeUrl(),
            project.healthCheckPath(),
            properties.healthTimeout(),
            () -> runtime.isRunning(green.instanceId()) && port.portLooksRight());

    if (!result.healthy()) {
      HealthResult reason =
          port.problem()
              .map(p -> new HealthResult(false, result.attempts(), result.elapsed(), p))
              .orElse(result);
      rejectGreen(id, green, reason);
      return;
    }

    say(id, "Healthy after " + result.attempts() + " check(s): " + result.detail());
    runtime.promote(green.instanceId());
    List<RuntimeInstanceRecord> blue =
        transitions.activeInstances(project.id()).stream()
            .filter(instance -> !instance.deploymentId().equals(id))
            .toList();
    transitions.goLive(id);

    if (!blue.isEmpty()) {
      pause();
      for (RuntimeInstanceRecord old : blue) {
        runtime.stop(old.externalId());
        transitions.markInstanceStopped(old.deploymentId());
      }
      say(id, "Stopped the previous version");
    }
    say(id, "Live at " + appUrls.urlFor(project.slug()));
  }

  private void rejectGreen(UUID id, RunningInstance green, HealthResult result) {
    runtime
        .recentOutput(green.instanceId(), CRASH_OUTPUT_LINES)
        .forEach(line -> logs.append(id, LogSource.RUNTIME, line));
    String exit = runtime.exitDescription(green.instanceId());
    runtime.stop(green.instanceId());
    transitions.markInstanceStopped(id);
    logs.append(
        id,
        LogSource.SYSTEM,
        "✖ New version is unhealthy ("
            + result.detail()
            + "). The previous version keeps serving.");
    transitions.fail(id, FailureReason.UNHEALTHY, result.detail() + "; container " + exit);
  }

  private ContainerSpec containerSpec(RolloutContext context) {
    ProjectSnapshot project = context.project();
    return ContainerSpec.builder()
        .name("forge-" + project.slug() + "-" + context.deploymentId().toString().substring(0, 8))
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

  private void say(UUID deploymentId, String message) {
    logs.append(deploymentId, LogSource.DEPLOY, "▶ " + message);
  }
}
