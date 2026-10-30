package com.forge.runtime.infrastructure;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds Traefik's dynamic configuration (the JSON its HTTP provider polls) from the app instances
 * that are running. All instances of one project share a router and service, so during a blue-green
 * swap Traefik balances across old and new, and its own health check keeps traffic away from an
 * instance that isn't ready. This is the Apple-container counterpart of {@link TraefikLabels}.
 */
final class TraefikRoutes {

  /** One project's route and the instances (base URLs) currently serving it. */
  record Route(String name, String host, String healthPath, List<String> servers) {}

  private TraefikRoutes() {}

  static Map<String, Object> config(List<Route> routes) {
    Map<String, Object> routers = new LinkedHashMap<>();
    Map<String, Object> services = new LinkedHashMap<>();
    Map<String, Object> middlewares = new LinkedHashMap<>();
    for (Route route : routes) {
      String retry = route.name() + "-retry";
      routers.put(
          route.name(),
          Map.of(
              "rule", "Host(`" + route.host() + "`)",
              "entryPoints", List.of("web"),
              "service", route.name(),
              "middlewares", List.of(retry)));
      // A connection error on an instance that is booting or draining is retried on the other one.
      middlewares.put(retry, Map.of("retry", Map.of("attempts", 5, "initialInterval", "200ms")));
      services.put(
          route.name(),
          Map.of(
              "loadBalancer",
              Map.of(
                  "healthCheck",
                  Map.of("path", route.healthPath(), "interval", "2s", "timeout", "2s"),
                  "servers",
                  route.servers().stream().map(url -> Map.of("url", url)).toList())));
    }
    if (routers.isEmpty()) {
      return Map.of(); // Traefik rejects empty sections; an empty object means "no routes"
    }
    return Map.of(
        "http", Map.of("routers", routers, "services", services, "middlewares", middlewares));
  }
}
