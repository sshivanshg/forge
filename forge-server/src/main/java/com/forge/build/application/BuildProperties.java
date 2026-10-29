package com.forge.build.application;

import java.nio.file.Path;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param registry where images are pushed, e.g. {@code localhost:5001}; empty keeps images in the
 *     engine's local image store (Apple container runs them from there)
 * @param timeout a build running longer than this is killed and fails with BUILD_TIMEOUT
 * @param workspaceDir parent directory of per-deployment checkouts (deleted after each build)
 * @param builderMemoryMb memory for the Apple container build VM
 */
@ConfigurationProperties("forge.build")
public record BuildProperties(
    String registry,
    @DefaultValue("10m") Duration timeout,
    Path workspaceDir,
    @DefaultValue("2048") int builderMemoryMb) {

  public boolean usesRegistry() {
    return registry != null && !registry.isBlank();
  }
}
