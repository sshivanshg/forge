package com.forge.agent.application;

import com.forge.agent.domain.ActionPlan;
import com.forge.agent.domain.ActionSource;
import com.forge.agent.domain.HealthPolicy;
import com.forge.agent.domain.HealthWindow;
import com.forge.deployment.DeploymentCommands;
import com.forge.deployment.DeploymentQueries;
import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentView;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.TrafficMetrics;
import com.forge.runtime.TrafficSample;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Watches every LIVE app's real traffic, as Traefik measured it, and asks {@link HealthPolicy}
 * whether it is degrading. A verdict becomes a proposal (roll back, or scale out) for the owner to
 * approve; the watcher itself never changes anything.
 *
 * <p>Per project it keeps the last cumulative sample (to compute what happened in this interval)
 * and a baseline latency learned from healthy intervals with an exponential moving average. Both
 * reset when a new version goes live. The state is in memory: after a restart the watcher simply
 * learns again.
 */
@Component
class LiveHealthWatcher {

  private static final Logger log = LoggerFactory.getLogger(LiveHealthWatcher.class);
  private static final double BASELINE_WEIGHT = 0.2;

  private final ProjectCatalog projects;
  private final DeploymentQueries queries;
  private final DeploymentCommands deployments;
  private final AgentActionService actions;
  private final ObjectProvider<TrafficMetrics> metrics;
  private final AgentProperties properties;
  private final Map<UUID, Tracker> trackers = new ConcurrentHashMap<>();

  LiveHealthWatcher(
      ProjectCatalog projects,
      DeploymentQueries queries,
      DeploymentCommands deployments,
      AgentActionService actions,
      ObjectProvider<TrafficMetrics> metrics,
      AgentProperties properties) {
    this.projects = projects;
    this.queries = queries;
    this.deployments = deployments;
    this.actions = actions;
    this.metrics = metrics;
    this.properties = properties;
  }

  @Scheduled(
      fixedDelayString = "${forge.agent.health-watch-interval-ms:30000}",
      initialDelay = 45_000)
  void scheduledCheck() {
    TrafficMetrics traffic = metrics.getIfAvailable();
    if (!properties.healthWatch() || traffic == null) {
      return;
    }
    for (ProjectSnapshot project : projects.listLive()) {
      try {
        traffic
            .sample(project.slug(), project.liveDeploymentId())
            .flatMap(sample -> observe(project, sample))
            .ifPresent(verdict -> recommend(project, verdict));
      } catch (RuntimeException e) {
        log.warn("Health watch of {} failed: {}", project.slug(), e.getMessage());
      }
    }
  }

  /** Feeds one cumulative sample in; returns a verdict for the interval since the last one. */
  Optional<HealthPolicy.Verdict> observe(ProjectSnapshot project, TrafficSample cumulative) {
    UUID live = project.liveDeploymentId();
    Tracker tracker = trackers.get(project.id());
    if (tracker == null || !tracker.deploymentId().equals(live)) {
      trackers.put(project.id(), new Tracker(live, cumulative, 0));
      return Optional.empty(); // first look at this version: nothing to compare yet
    }
    TrafficSample interval = cumulative.minus(tracker.last());
    HealthWindow window =
        new HealthWindow(
            interval.requests(),
            interval.errorRate(),
            interval.meanLatencyMillis(),
            tracker.baseline(),
            project.replicas());
    Optional<HealthPolicy.Verdict> verdict = HealthPolicy.assess(window);
    double baseline = tracker.baseline();
    if (verdict.isEmpty() && interval.requests() > 0) {
      baseline =
          baseline == 0
              ? interval.meanLatencyMillis()
              : (1 - BASELINE_WEIGHT) * baseline + BASELINE_WEIGHT * interval.meanLatencyMillis();
    }
    trackers.put(project.id(), new Tracker(live, cumulative, baseline));
    return verdict;
  }

  private void recommend(ProjectSnapshot project, HealthPolicy.Verdict verdict) {
    DeploymentView live = queries.get(project.liveDeploymentId());
    if (live.status() != DeploymentStatus.LIVE || deploymentInFlight(project)) {
      // The owner already acted (e.g. an approved rollback is rolling out): a new proposal now
      // would be stale by the time it is read, and approving it would only repeat the deploy.
      log.debug("Health watch of {}: a deployment is in flight, no proposal", project.slug());
      return;
    }
    switch (verdict) {
      case ROLLBACK ->
          previousGood(project)
              .ifPresent(
                  previous ->
                      actions.propose(
                          project.id(),
                          live.id(),
                          ActionSource.HEALTH_WATCH,
                          ActionPlan.rollback(
                              previous.id(),
                              "Roll back to " + shortSha(previous.commitSha()),
                              "The live version started failing requests with 5xx errors. The"
                                  + " previous version served without these errors.")));
      case SCALE_OUT -> {
        if (project.replicas() < 3) {
          actions.propose(
              project.id(),
              live.id(),
              ActionSource.HEALTH_WATCH,
              ActionPlan.scaleOut(
                  project.replicas() + 1,
                  live.commitSha(),
                  "Scale out to " + (project.replicas() + 1) + " replicas",
                  "Responses got much slower than usual under load while errors stayed low,"
                      + " which points at too little capacity rather than a bug."));
        }
      }
    }
  }

  private boolean deploymentInFlight(ProjectSnapshot project) {
    return deployments.recent(project.id(), 20).stream()
        .anyMatch(d -> d.status() == DeploymentStatus.QUEUED || d.status().isInProgress());
  }

  /** The newest earlier deployment that went live and still has an image. */
  private Optional<DeploymentView> previousGood(ProjectSnapshot project) {
    return deployments.recent(project.id(), 20).stream()
        .filter(d -> !d.id().equals(project.liveDeploymentId()))
        .filter(d -> d.status() == DeploymentStatus.SUPERSEDED && d.imageRef() != null)
        .findFirst();
  }

  private static String shortSha(String sha) {
    return sha == null ? "the previous version" : sha.substring(0, Math.min(7, sha.length()));
  }

  private record Tracker(UUID deploymentId, TrafficSample last, double baseline) {}
}
