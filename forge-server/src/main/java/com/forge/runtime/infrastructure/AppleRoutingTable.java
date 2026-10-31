package com.forge.runtime.infrastructure;

import com.forge.runtime.TrafficSplitter;
import com.forge.runtime.application.RoutingTable;
import com.forge.runtime.infrastructure.TraefikRoutes.Route;
import com.forge.runtime.infrastructure.TraefikRoutes.Version;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the routing table from the containers that are actually running, using the labels Forge
 * put on them. Nothing is kept only in memory, so a restarted control plane serves the same routes.
 * The result is cached briefly because Traefik polls every second.
 *
 * <p>Traffic splits (canary rollouts) are the one thing kept in memory: after a restart of the
 * control plane every version gets an equal share again until the rollout's job is retried.
 */
class AppleRoutingTable implements RoutingTable, TrafficSplitter {

  /** During a canary: {@code percent} of the route's traffic goes to {@code deploymentId}. */
  record Split(String deploymentId, int percent) {}

  static final String MANAGED = "forge.managed";
  static final String ROUTE = "forge.route";
  static final String HOST = "forge.host";
  static final String PORT = "forge.port";
  static final String HEALTH_PATH = "forge.health-path";

  static final String DEPLOYMENT = "forge.deployment";

  private static final Logger log = LoggerFactory.getLogger(AppleRoutingTable.class);
  private static final Duration MAX_AGE = Duration.ofSeconds(10);

  private final AppleContainers containers;
  private final Clock clock;
  private final Map<String, Split> splits = new ConcurrentHashMap<>();
  private volatile Map<String, Object> config;
  private volatile Instant refreshedAt = Instant.EPOCH;

  AppleRoutingTable(AppleContainers containers, Clock clock) {
    this.containers = containers;
    this.clock = clock;
  }

  @Override
  public Map<String, Object> current() {
    if (config == null || refreshedAt.plus(MAX_AGE).isBefore(clock.instant())) {
      refresh();
    }
    return config == null ? Map.of() : config;
  }

  @Override
  public synchronized void refresh() {
    try {
      config = TraefikRoutes.config(routes(containers.list(), splits));
      refreshedAt = clock.instant();
    } catch (RuntimeException e) {
      // Keep serving the last known table; Traefik's health checks cover instances that died.
      log.warn("Could not refresh routes: {}", e.getMessage());
    }
  }

  @Override
  public void split(String routeName, UUID deploymentId, int percent) {
    if (percent < 0 || percent > 100) {
      throw new IllegalArgumentException("percent must be between 0 and 100");
    }
    splits.put(routeName, new Split(deploymentId.toString(), percent));
    refresh();
  }

  @Override
  public void reset(String routeName) {
    splits.remove(routeName);
    refresh();
  }

  static List<Route> routes(List<AppleContainers.Info> all) {
    return routes(all, Map.of());
  }

  /** Groups running containers by route, then by deployment (version), and applies the splits. */
  static List<Route> routes(List<AppleContainers.Info> all, Map<String, Split> splits) {
    Map<String, Map<String, List<String>>> serversByRoute = new TreeMap<>();
    Map<String, Map<String, String>> labelsByRoute = new TreeMap<>();
    for (AppleContainers.Info c : all) {
      Map<String, String> l = c.labels();
      if (!c.running() || c.ipv4() == null || !"true".equals(l.get(MANAGED))) {
        continue;
      }
      String name = l.get(ROUTE);
      labelsByRoute.putIfAbsent(name, l);
      serversByRoute
          .computeIfAbsent(name, k -> new TreeMap<>())
          .computeIfAbsent(l.getOrDefault(DEPLOYMENT, name), k -> new ArrayList<>())
          .add("http://" + c.ipv4() + ":" + l.get(PORT));
    }
    List<Route> routes = new ArrayList<>();
    serversByRoute.forEach(
        (name, byDeployment) -> {
          Map<String, String> l = labelsByRoute.get(name);
          routes.add(
              new Route(
                  name,
                  l.get(HOST),
                  l.getOrDefault(HEALTH_PATH, "/"),
                  versions(byDeployment, splits.get(name))));
        });
    return List.copyOf(routes);
  }

  private static List<Version> versions(Map<String, List<String>> byDeployment, Split split) {
    boolean splitApplies = split != null && byDeployment.containsKey(split.deploymentId());
    int others = byDeployment.size() - (splitApplies ? 1 : 0);
    List<Version> versions = new ArrayList<>();
    byDeployment.forEach(
        (deployment, servers) -> {
          int weight;
          if (!splitApplies) {
            weight = 1;
          } else if (deployment.equals(split.deploymentId())) {
            weight = split.percent();
          } else {
            weight = others == 0 ? 0 : (100 - split.percent()) / others;
          }
          versions.add(new Version(deployment, List.copyOf(servers), weight));
        });
    if (versions.stream().allMatch(v -> v.weight() == 0)) {
      // Never leave a route with nothing to send traffic to
      return versions.stream().map(v -> new Version(v.deploymentId(), v.servers(), 1)).toList();
    }
    return versions;
  }
}
