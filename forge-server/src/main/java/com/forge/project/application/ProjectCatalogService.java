package com.forge.project.application;

import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.project.domain.Project;
import com.forge.project.infrastructure.ProjectRepository;
import com.forge.shared.error.NotFoundException;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Implements the module's public API ({@link ProjectCatalog}) for other modules. */
@Service
class ProjectCatalogService implements ProjectCatalog {

  private final ProjectRepository projects;
  private final EnvironmentService environment;
  private final Clock clock;

  ProjectCatalogService(ProjectRepository projects, EnvironmentService environment, Clock clock) {
    this.projects = projects;
    this.environment = environment;
    this.clock = clock;
  }

  @Override
  @Transactional(readOnly = true)
  public ProjectSnapshot getOwned(UUID projectId, UUID ownerId) {
    return projects
        .findOwned(projectId, ownerId)
        .map(Project::snapshot)
        .orElseThrow(() -> new NotFoundException("Project", projectId));
  }

  @Override
  @Transactional(readOnly = true)
  public ProjectSnapshot get(UUID projectId) {
    return projects
        .findById(projectId)
        .map(Project::snapshot)
        .orElseThrow(() -> new NotFoundException("Project", projectId));
  }

  @Override
  @Transactional(readOnly = true)
  public List<ProjectSnapshot> findAutoDeployTargets(
      String repoOwner, String repoName, String branch) {
    return projects.findAutoDeployTargets(repoOwner, repoName, branch).stream()
        .map(Project::snapshot)
        .toList();
  }

  @Override
  public Map<String, String> environmentOf(UUID projectId) {
    return environment.decrypted(projectId);
  }

  @Override
  @Transactional
  public void recordLiveDeployment(UUID projectId, UUID deploymentId) {
    projects.findById(projectId).ifPresent(p -> p.markLive(deploymentId, clock.instant()));
  }
}
