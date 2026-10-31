package com.forge.project;

import com.forge.build.BuildType;
import java.util.UUID;

/** Immutable, read-only view of a project shared with other modules. */
public record ProjectSnapshot(
    UUID id,
    UUID ownerId,
    String name,
    String slug,
    String repoOwner,
    String repoName,
    String branch,
    String rootDir,
    BuildType buildType,
    int port,
    String healthCheckPath,
    boolean autoDeploy,
    int replicas,
    RolloutMode rollout,
    UUID liveDeploymentId) {}
