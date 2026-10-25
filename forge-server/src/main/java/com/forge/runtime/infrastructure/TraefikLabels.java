package com.forge.runtime.infrastructure;

import com.forge.runtime.ContainerSpec;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Builds the Docker labels Traefik reads to route {@code <slug>.localhost} to a container. Every
 * container of a project uses the same router and service name, so during a blue-green swap Traefik
 * load-balances across old and new, and its own health check keeps traffic away from an instance
 * that is not ready yet.
 */
final class TraefikLabels {

  private TraefikLabels() {}

  static Map<String, String> forSpec(ContainerSpec spec, String network) {
    String router = "traefik.http.routers." + spec.routeName();
    String service = "traefik.http.services." + spec.routeName();
    Map<String, String> labels = new LinkedHashMap<>();
    labels.put("forge.managed", "true");
    labels.put("forge.project", spec.projectSlug());
    labels.put("forge.deployment", spec.deploymentId().toString());
    labels.put("traefik.enable", "true");
    labels.put("traefik.docker.network", network);
    labels.put(router + ".rule", "Host(`" + spec.routeHost() + "`)");
    labels.put(router + ".entrypoints", "web");
    labels.put(router + ".service", spec.routeName());
    labels.put(service + ".loadbalancer.server.port", Integer.toString(spec.port()));
    labels.put(service + ".loadbalancer.healthcheck.path", spec.healthPath());
    labels.put(service + ".loadbalancer.healthcheck.interval", "2s");
    labels.put(service + ".loadbalancer.healthcheck.timeout", "2s");
    return labels;
  }
}
