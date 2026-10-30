package com.forge.shared.docker;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param host Docker engine address, e.g. {@code unix:///var/run/docker.sock}. Empty means
 *     auto-detect.
 */
@ConfigurationProperties("forge.docker")
public record DockerProperties(String host) {}
