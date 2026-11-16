package com.forge.project.application;

import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSettings;
import com.forge.project.ProjectSnapshot;
import com.forge.project.SettingsChange;
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
class ProjectCatalogService implements ProjectCatalog, ProjectSettings {

  private final ProjectRepository projects;
  private final EnvironmentService environment;
  private final ProjectService service;
  private final Clock clock;

  ProjectCatalogService(
      ProjectRepository projects,
      EnvironmentService environment,
      ProjectService service,
      Clock clock) {
    this.projects = projects;
    this.environment = environment;
    this.service = service;
    this.clock = clock;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ProjectSnapshot> listLive() {
    return projects.findAll().stream()
        .map(Project::snapshot)
        .filter(p -> p.liveDeploymentId() != null)
        .toList();
  }

  @Override
  @Transactional
  public ProjectSnapshot apply(UUID projectId, UUID ownerId, SettingsChange change) {
    return service
        .update(
            ownerId,
            projectId,
            new UpdateProjectCommand(
                null,
                null,
                null,
                null,
                change.rootDir(),
                change.buildType(),
                change.port(),
                change.healthCheckPath(),
                null,
                change.replicas(),
                null))
        .snapshot();
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
  public List<ProjectSnapshot> listOwned(UUID ownerId) {
    return projects.findAllOwned(ownerId).stream().map(Project::snapshot).toList();
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
