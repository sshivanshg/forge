package com.forge.project.application;

import com.forge.build.BuildType;

/** Partial update: {@code null} means "leave unchanged". The slug is immutable by design. */
public record UpdateProjectCommand(
    String name,
    String repoOwner,
    String repoName,
    String branch,
    String rootDir,
    BuildType buildType,
    Integer port,
    String healthCheckPath,
    Boolean autoDeploy) {}
