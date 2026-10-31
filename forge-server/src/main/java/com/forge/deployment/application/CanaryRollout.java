package com.forge.deployment.application;

import com.forge.deployment.FailureReason;
import com.forge.deployment.application.CanaryAnalysis.Verdict;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.RunningInstance;
import com.forge.runtime.RuntimeProvider;
import com.forge.runtime.TrafficMetrics;
import com.forge.runtime.TrafficSample;
import com.forge.runtime.TrafficSplitter;
import com.forge.shared.config.AppUrls;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Canary rollout: the new version earns its traffic.
 *
 * <ol>
 *   <li>Start and health-check the new version with 0% of the traffic.
 *   <li>For each step (20%, then 50% by default): send it that share of the real traffic, watch it
 *       for a while, then compare its 5xx rate and latency with the live version's over the same
 *       period ({@link CanaryAnalysis}).
 *   <li>Worse → move all traffic back to the live version, remove the new one and mark the
 *       deployment FAILED (CANARY_REGRESSION). Visitors only ever saw the canary's share.
 *   <li>Every step passed → 100%, LIVE, and the old version is stopped.
 * </ol>
 *
 * <p>The proxy does the splitting and the measuring ({@link TrafficSplitter}, {@link
 * TrafficMetrics}); this class is the control loop around them.
 */
@Component
class CanaryRollout implements RolloutStrategy {

  private static final Duration LIVENESS_CHECK = Duration.ofSeconds(1);

  private final RolloutSteps steps;
  private final DeploymentTransitions transitions;
  private final RuntimeProvider runtime;
  private final ObjectProvider<TrafficSplitter> splitter;
  private final ObjectProvider<TrafficMetrics> metrics;
  private final AppUrls appUrls;
  private final DeploymentProperties.Canary rules;
  private final CanaryAnalysis analysis;
  private final SyntheticTraffic traffic;

  CanaryRollout(
      RolloutSteps steps,
      DeploymentTransitions transitions,
      RuntimeProvider runtime,
      ObjectProvider<TrafficSplitter> splitter,
      ObjectProvider<TrafficMetrics> metrics,
      AppUrls appUrls,
      DeploymentProperties properties) {
    this.steps = steps;
    this.transitions = transitions;
    this.runtime = runtime;
    this.splitter = splitter;
    this.metrics = metrics;
    this.appUrls = appUrls;
    this.rules = properties.canary();
    this.analysis = new CanaryAnalysis(rules);
    this.traffic = new SyntheticTraffic(rules.proxyUrl());
  }

  /** Can this engine split and measure traffic? (Apple container yes; Docker labels no.) */
  boolean available() {
    return splitter.getIfAvailable() != null && metrics.getIfAvailable() != null;
  }

  @Override
  public void rollout(RolloutContext context) {
    UUID id = context.deploymentId();
    ProjectSnapshot project = context.project();
    TrafficSplitter proxy = splitter.getObject();
    String route = project.slug();

    // Hold the new version at 0% until it is healthy, so not a single visitor reaches it early
    proxy.split(route, id, 0);
    Optional<List<RunningInstance>> started;
    try {
      started = steps.startHealthy(context);
    } catch (RuntimeException e) {
      proxy.reset(route);
      throw e;
    }
    if (started.isEmpty()) {
      proxy.reset(route);
      return;
    }
    List<RunningInstance> canary = started.get();
    UUID live = project.liveDeploymentId();

    try {
      for (int i = 0; i < rules.steps().size(); i++) {
        int percent = rules.steps().get(i);
        proxy.split(route, id, percent);
        if (i == 0) {
          transitions.startCanary(id, percent);
        } else {
          transitions.shiftTraffic(id, percent);
        }
        steps.say(
            id,
            "Canary step "
                + (i + 1)
                + "/"
                + rules.steps().size()
                + ": "
                + percent
                + "% of traffic to the new version, watching for "
                + rules.stepDuration().toSeconds()
                + "s");
        Verdict verdict = watch(context, canary, live);
        if (verdict.regression()) {
          rollBack(id, route, canary, percent, verdict.summary());
          return;
        }
        steps.say(id, describe(verdict));
      }
    } catch (RuntimeException e) {
      proxy.split(route, id, 0); // whatever went wrong, the live version takes the traffic back
      throw e;
    }

    proxy.split(route, id, 100);
    transitions.goLive(id);
    steps.say(id, "Canary passed: 100% of traffic to the new version");
    steps.retirePreviousVersions(id, project);
    proxy.reset(route);
    steps.announceLive(id, project);
  }

  /**
   * A retried job found the deployment mid-canary (the control plane restarted): its step results
   * are lost, so the safe move is to give the traffic back to the live version and fail it.
   */
  void abandon(RolloutContext context) {
    UUID id = context.deploymentId();
    String route = context.project().slug();
    splitter.ifAvailable(proxy -> proxy.split(route, id, 0));
    transitions.instancesOf(id).forEach(instance -> runtime.stop(instance.externalId()));
    transitions.markInstancesStopped(id);
    splitter.ifAvailable(proxy -> proxy.reset(route));
    steps.warn(
        id,
        "✖ The canary was interrupted (Forge restarted). All traffic is back on the live"
            + " version; deploy again to retry.");
    transitions.fail(id, FailureReason.RUNTIME_ERROR, "Canary interrupted by a restart");
  }

  /** Watches one step: drives test traffic, checks the canary is still up, then judges it. */
  private Verdict watch(RolloutContext context, List<RunningInstance> canary, UUID live) {
    String route = context.project().slug();
    String host = appUrls.hostFor(route);
    Optional<TrafficSample> canaryBefore = sample(route, context.deploymentId());
    Optional<TrafficSample> liveBefore = sample(route, live);

    long end = System.nanoTime() + rules.stepDuration().toNanos();
    long nextLivenessCheck = 0;
    long gapNanos = rules.syntheticRps() > 0 ? 1_000_000_000L / rules.syntheticRps() : 0;
    while (System.nanoTime() < end && !Thread.currentThread().isInterrupted()) {
      if (System.nanoTime() >= nextLivenessCheck) {
        for (RunningInstance instance : canary) {
          if (!runtime.isRunning(instance.instanceId())) {
            return new Verdict(
                CanaryAnalysis.Outcome.REGRESSION, "the new version stopped running");
          }
        }
        nextLivenessCheck = System.nanoTime() + LIVENESS_CHECK.toNanos();
      }
      long started = System.nanoTime();
      if (gapNanos > 0) {
        traffic.get(host);
      }
      sleepNanos(Math.max(gapNanos, LIVENESS_CHECK.toNanos() / 10) - (System.nanoTime() - started));
    }

    Optional<TrafficSample> canaryAfter = sample(route, context.deploymentId());
    Optional<TrafficSample> liveAfter = sample(route, live);
    if (canaryBefore.isEmpty() || canaryAfter.isEmpty()) {
      return new Verdict(
          CanaryAnalysis.Outcome.INCONCLUSIVE, "the proxy's traffic metrics could not be read");
    }
    TrafficSample liveDelta =
        liveBefore.isPresent() && liveAfter.isPresent()
            ? liveAfter.get().minus(liveBefore.get())
            : TrafficSample.NONE;
    return analysis.judge(canaryAfter.get().minus(canaryBefore.get()), liveDelta);
  }

  private void rollBack(
      UUID id, String route, List<RunningInstance> canary, int percent, String reason) {
    TrafficSplitter proxy = splitter.getObject();
    proxy.split(route, id, 0); // first, before anything slow: visitors go back to the live version
    steps.warn(
        id,
        "✖ Canary rolled back at "
            + percent
            + "% of traffic: "
            + reason
            + ". All traffic is back on the live version.");
    steps.removeNewVersion(id, canary, canary.getFirst());
    proxy.reset(route);
    transitions.fail(id, FailureReason.CANARY_REGRESSION, reason);
  }

  private Optional<TrafficSample> sample(String route, UUID deploymentId) {
    return deploymentId == null
        ? Optional.empty()
        : metrics.getObject().sample(route, deploymentId);
  }

  private static String describe(Verdict verdict) {
    return switch (verdict.outcome()) {
      case HEALTHY -> "Step passed: " + verdict.summary();
      case INCONCLUSIVE -> "Step passed on health checks alone: " + verdict.summary();
      case REGRESSION -> "Regression: " + verdict.summary();
    };
  }

  private static void sleepNanos(long nanos) {
    if (nanos <= 0) {
      return;
    }
    try {
      Thread.sleep(Duration.ofNanos(nanos));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
