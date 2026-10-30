package com.forge.runtime.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param network Docker network shared by user apps and Traefik (never by Postgres)
 * @param memoryMb memory limit per app container
 * @param cpus CPU limit per app container
 * @param probeHost host interface the app's port is published on for health checks (Docker)
 * @param routingToken shared secret Traefik sends when polling the routing table (Apple container)
 */
@ConfigurationProperties("forge.runtime")
public record RuntimeProperties(
    @DefaultValue("forge-apps") String network,
    @DefaultValue("512") int memoryMb,
    @DefaultValue("1.0") double cpus,
    @DefaultValue("127.0.0.1") String probeHost,
    String routingToken) {}
