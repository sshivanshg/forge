package com.forge.deployment.application;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentView;
import com.forge.deployment.domain.Deployment;
import com.forge.deployment.domain.RuntimeInstanceRecord;
import com.forge.deployment.infrastructure.DeploymentRepository;
import com.forge.deployment.infrastructure.RuntimeInstanceRepository;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.TrafficMetrics;
import com.forge.runtime.TrafficSample;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only dashboard queries: traffic of one version, running instances of a project, recent
 * activity and the overview numbers. Everything is scoped to the caller's own projects.
 */
@Service
public class DeploymentInsightsService {

  /** A deployment that reached LIVE at some point (it may have been replaced since). */
  static final Set<DeploymentStatus> SUCCEEDED =
      EnumSet.of(DeploymentStatus.LIVE, DeploymentStatus.SUPERSEDED, DeploymentStatus.STOPPED);

  private static final Logger log = LoggerFactory.getLogger(DeploymentInsightsService.class);
  private static final int CHART_DAYS = 14;

  private final DeploymentRepository deployments;
  private final RuntimeInstanceRepository instances;
  private final DeploymentQueryService queries;
  private final ProjectCatalog projects;
  private final ObjectProvider<TrafficMetrics> metrics;
  private final Clock clock;

  public DeploymentInsightsService(
      DeploymentRepository deployments,
      RuntimeInstanceRepository instances,
      DeploymentQueryService queries,
      ProjectCatalog projects,
      ObjectProvider<TrafficMetrics> metrics,
      Clock clock) {
    this.deployments = deployments;
    this.instances = instances;
    this.queries = queries;
    this.projects = projects;
    this.metrics = metrics;
    this.clock = clock;
  }

  public record Traffic(
      UUID deploymentId,
      long requests,
      long serverErrors,
      double errorRate,
      double meanLatencyMs,
      Instant sampledAt) {}

  public record Instance(
      UUID id,
      UUID deploymentId,
      int replicaIndex,
      String containerId,
      String address,
      String state,
      Instant startedAt,
      int trafficWeight) {}

  public record Activity(
      DeploymentView deployment, UUID projectId, String projectName, String projectSlug) {}

  public record DayCount(LocalDate date, long succeeded, long failed) {}

  public record Overview(
      int projects,
      int liveProjects,
      long deploys7d,
      long failed7d,
      Double successRate7d,
      Long medianDeployMs7d,
      List<DayCount> deploysByDay) {}

  /** Cumulative proxy counters of one version; zeros when the proxy has none or is unreachable. */
  @Transactional(readOnly = true)
  public Traffic traffic(UUID deploymentId, UUID userId) {
    DeploymentView deployment = queries.getOwned(deploymentId, userId);
    String route = projects.get(deployment.projectId()).slug();
    TrafficSample sample = TrafficSample.NONE;
    TrafficMetrics source = metrics.getIfAvailable();
    if (source != null) {
      try {
        sample = source.sample(route, deploymentId).orElse(TrafficSample.NONE);
      } catch (RuntimeException e) {
        log.debug("Traffic metrics unavailable: {}", e.getMessage());
      }
    }
    return new Traffic(
        deploymentId,
        sample.requests(),
        sample.serverErrors(),
        sample.errorRate(),
        sample.meanLatencyMillis(),
        clock.instant());
  }

  /**
   * Containers of the project that are not stopped. The traffic weight (0..100) is the share of the
   * route each one's version receives: the canary's {@code trafficPercent} during a canary, an
   * equal share per version otherwise (the proxy's default).
   */
  @Transactional(readOnly = true)
  public List<Instance> instances(UUID projectId, UUID userId) {
    projects.getOwned(projectId, userId);
    List<RuntimeInstanceRecord> active = instances.findActiveByProject(projectId);
    Map<UUID, Deployment> versions =
        deployments
            .findAllById(
                active.stream().map(RuntimeInstanceRecord::deploymentId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(Deployment::id, Function.identity()));
    Map<UUID, Integer> weights = weights(versions.values());
    return active.stream()
        .sorted(
            java.util.Comparator.comparing(RuntimeInstanceRecord::createdAt)
                .thenComparing(RuntimeInstanceRecord::replica))
        .map(
            r ->
                new Instance(
                    r.id(),
                    r.deploymentId(),
                    r.replica(),
                    r.externalId(),
                    r.internalUrl(),
                    r.status().name(),
                    r.createdAt(),
                    weights.getOrDefault(r.deploymentId(), 0)))
        .toList();
  }

  static Map<UUID, Integer> weights(java.util.Collection<Deployment> versions) {
    Map<UUID, Integer> weights = new LinkedHashMap<>();
    if (versions.isEmpty()) {
      return weights;
    }
    Deployment canary =
        versions.stream()
            .filter(d -> d.status() == DeploymentStatus.CANARY && d.trafficPercent() != null)
            .findFirst()
            .orElse(null);
    if (canary == null) {
      versions.forEach(d -> weights.put(d.id(), 100 / versions.size()));
      return weights;
    }
    int others = versions.size() - 1;
    for (Deployment d : versions) {
      weights.put(
          d.id(),
          d == canary
              ? canary.trafficPercent()
              : others == 0 ? 0 : (100 - canary.trafficPercent()) / others);
    }
    return weights;
  }

  @Transactional(readOnly = true)
  public List<Activity> activity(UUID userId, int limit) {
    Map<UUID, ProjectSnapshot> owned = owned(userId);
    if (owned.isEmpty()) {
      return List.of();
    }
    return deployments.findRecent(owned.keySet(), PageRequest.of(0, limit)).stream()
        .map(
            d -> {
              ProjectSnapshot p = owned.get(d.projectId());
              return new Activity(queries.toView(d, false), p.id(), p.name(), p.slug());
            })
        .toList();
  }

  @Transactional(readOnly = true)
  public Overview overview(UUID userId) {
    Map<UUID, ProjectSnapshot> owned = owned(userId);
    int live = (int) owned.values().stream().filter(p -> p.liveDeploymentId() != null).count();
    LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
    LocalDate firstDay = today.minusDays(CHART_DAYS - 1);
    Instant weekAgo = clock.instant().minus(Duration.ofDays(7));
    List<Deployment> recent =
        owned.isEmpty()
            ? List.of()
            : deployments.findCreatedSince(
                owned.keySet(), firstDay.atStartOfDay(ZoneOffset.UTC).toInstant());

    Map<LocalDate, long[]> byDay = new LinkedHashMap<>();
    for (int i = 0; i < CHART_DAYS; i++) {
      byDay.put(firstDay.plusDays(i), new long[2]);
    }
    long deploys7d = 0;
    long succeeded7d = 0;
    long failed7d = 0;
    List<Long> durations = new ArrayList<>();
    for (Deployment d : recent) {
      boolean ok = SUCCEEDED.contains(d.status());
      boolean failed = d.status() == DeploymentStatus.FAILED;
      long[] day = byDay.get(LocalDate.ofInstant(d.createdAt(), ZoneOffset.UTC));
      if (day != null) {
        day[0] += ok ? 1 : 0;
        day[1] += failed ? 1 : 0;
      }
      if (d.createdAt().isBefore(weekAgo)) {
        continue;
      }
      deploys7d++;
      if (ok) {
        succeeded7d++;
        if (d.startedAt() != null && d.finishedAt() != null) {
          durations.add(Duration.between(d.startedAt(), d.finishedAt()).toMillis());
        }
      } else if (failed) {
        failed7d++;
      }
    }
    long finished = succeeded7d + failed7d;
    return new Overview(
        owned.size(),
        live,
        deploys7d,
        failed7d,
        finished == 0 ? null : (double) succeeded7d / finished,
        median(durations),
        byDay.entrySet().stream()
            .map(e -> new DayCount(e.getKey(), e.getValue()[0], e.getValue()[1]))
            .toList());
  }

  static Long median(List<Long> values) {
    if (values.isEmpty()) {
      return null;
    }
    List<Long> sorted = values.stream().sorted().toList();
    int mid = sorted.size() / 2;
    return sorted.size() % 2 == 1 ? sorted.get(mid) : (sorted.get(mid - 1) + sorted.get(mid)) / 2;
  }

  private Map<UUID, ProjectSnapshot> owned(UUID userId) {
    Map<UUID, ProjectSnapshot> owned = new LinkedHashMap<>();
    projects.listOwned(userId).forEach(p -> owned.put(p.id(), p));
    return owned;
  }
}
