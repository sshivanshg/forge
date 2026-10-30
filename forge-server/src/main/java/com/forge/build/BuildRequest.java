package com.forge.build;

import com.forge.source.GitRepository;
import java.util.Optional;
import java.util.UUID;

/** Everything needed to build one deployment's image. */
public record BuildRequest(
    UUID deploymentId,
    String projectSlug,
    GitRepository repository,
    String branch,
    String commitSha,
    Optional<String> accessToken,
    String rootDir,
    BuildType buildType,
    int port) {}
