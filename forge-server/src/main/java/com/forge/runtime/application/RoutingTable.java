package com.forge.runtime.application;

import java.util.Map;

/**
 * Port: the reverse proxy's routing table, served to Traefik's HTTP provider. Only engines without
 * label-based discovery (Apple container) need it; with Docker, Traefik reads container labels.
 */
public interface RoutingTable {

  /** Traefik dynamic configuration for every running app instance. */
  Map<String, Object> current();

  /** Re-reads the running instances now (called right after an instance starts or stops). */
  void refresh();
}
