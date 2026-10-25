package com.forge.project.application;

import com.forge.project.domain.BuildSettings;

/** Input of the "create project" use case (already shape-validated by the API layer). */
public record CreateProjectCommand(
    String name, String slug, String repoOwner, String repoName, BuildSettings settings) {}
