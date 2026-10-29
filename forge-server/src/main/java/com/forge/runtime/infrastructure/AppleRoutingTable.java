package com.forge.runtime.infrastructure;

import com.forge.runtime.application.RoutingTable;
import com.forge.runtime.infrastructure.TraefikRoutes.Route;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the routing table from the containers that are actually running, using the labels Forge
 * put on them. Nothing is kept only in memory, so a restarted control plane serves the same routes.
 * The result is cached briefly because Traefik polls every second.
 */
class AppleRoutingTable implements RoutingTable {

  static final String MANAGED = "forge.managed";
  static final String ROUTE = "forge.route";
  static final String HOST = "forge.host";
  static final String PORT = "forge.port";
  static final String HEALTH_PATH = "forge.health-path";

  private static final Logger log = LoggerFactory.getLogger(AppleRoutingTable.class);
  private static final Duration MAX_AGE = Duration.ofSeconds(10);

  private final AppleContainers containers;
  private final Clock clock;
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
      config = TraefikRoutes.config(routes(containers.list()));
      refreshedAt = clock.instant();
    } catch (RuntimeException e) {
      // Keep serving the last known table; Traefik's health checks cover instances that died.
      log.warn("Could not refresh routes: {}", e.getMessage());
    }
  }

  static List<Route> routes(List<AppleContainers.Info> all) {
    Map<String, Route> byName = new TreeMap<>();
    for (AppleContainers.Info c : all) {
      Map<String, String> l = c.labels();
      if (!c.running() || c.ipv4() == null || !"true".equals(l.get(MANAGED))) {
        continue;
      }
      String name = l.get(ROUTE);
      String url = "http://" + c.ipv4() + ":" + l.get(PORT);
      Route existing = byName.get(name);
      List<String> servers = new ArrayList<>(existing == null ? List.of() : existing.servers());
      servers.add(url);
      byName.put(name, new Route(name, l.get(HOST), l.getOrDefault(HEALTH_PATH, "/"), servers));
    }
    return List.copyOf(byName.values());
  }
}
