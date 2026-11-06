package com.forge.runtime.infrastructure;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds Traefik's dynamic configuration (the JSON its HTTP provider polls) from the app instances
 * that are running. This is the Apple-container counterpart of {@link TraefikLabels}.
 *
 * <p>Each project gets one router and one <em>weighted</em> service whose children are its versions
 * (one load balancer per deployment, over that deployment's replicas). Equal weights during a
 * blue-green swap; during a canary, the weights are the traffic split. Every child has its own
 * health check, and the weighted service follows them, so traffic never goes to a version with no
 * healthy instance. Separate children also give Traefik's metrics one series per version, which is
 * what the canary analysis compares.
 */
final class TraefikRoutes {

  /** One project's route and the versions currently serving it. */
  record Route(String name, String host, String healthPath, List<Version> versions) {

    List<String> servers() {
      return versions.stream().flatMap(v -> v.servers().stream()).toList();
    }
  }

  /** The running replicas (base URLs) of one deployment and its share of the traffic. */
  record Version(String deploymentId, List<String> servers, int weight) {}

  private TraefikRoutes() {}

  /** Traefik service name of one version; also the {@code service} label of its metrics. */
  static String serviceName(String routeName, String deploymentId) {
    return routeName + "-" + deploymentId.substring(0, 8);
  }

  static String serviceName(String routeName, UUID deploymentId) {
    return serviceName(routeName, deploymentId.toString());
  }

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
      // A connection error on an instance that is booting or draining is retried on another one.
      middlewares.put(retry, Map.of("retry", Map.of("attempts", 5, "initialInterval", "200ms")));
      List<Map<String, Object>> weighted =
          route.versions().stream()
              .filter(v -> v.weight() > 0)
              .map(
                  v ->
                      Map.<String, Object>of(
                          "name",
                          serviceName(route.name(), v.deploymentId()),
                          "weight",
                          v.weight()))
              .toList();
      services.put(
          route.name(), Map.of("weighted", Map.of("services", weighted, "healthCheck", Map.of())));
      for (Version version : route.versions()) {
        services.put(
            serviceName(route.name(), version.deploymentId()),
            Map.of(
                "loadBalancer",
                Map.of(
                    "healthCheck",
                    Map.of("path", route.healthPath(), "interval", "2s", "timeout", "2s"),
                    "servers",
                    version.servers().stream().map(url -> Map.of("url", url)).toList())));
      }
    }
    if (routers.isEmpty()) {
      return Map.of(); // Traefik rejects empty sections; an empty object means "no routes"
    }
    return Map.of(
        "http", Map.of("routers", routers, "services", services, "middlewares", middlewares));
  }
}
