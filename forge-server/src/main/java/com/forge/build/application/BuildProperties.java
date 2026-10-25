package com.forge.build.application;

import java.nio.file.Path;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param registry where images are pushed, e.g. {@code localhost:5001}
 * @param timeout a build running longer than this is killed and fails with BUILD_TIMEOUT
 * @param workspaceDir parent directory of per-deployment checkouts (deleted after each build)
 */
@ConfigurationProperties("forge.build")
public record BuildProperties(
    @DefaultValue("localhost:5001") String registry,
    @DefaultValue("10m") Duration timeout,
    Path workspaceDir) {}
