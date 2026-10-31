package com.forge.project.application;

import com.forge.project.ProjectDeleting;
import com.forge.project.domain.BuildSettings;
import com.forge.project.domain.Project;
import com.forge.project.domain.RepoRef;
import com.forge.project.domain.RunSettings;
import com.forge.project.domain.Slug;
import com.forge.project.infrastructure.ProjectRepository;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.shared.error.NotFoundException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Use cases a user performs on their own projects. Every method enforces ownership. */
@Service
public class ProjectService {

  private final ProjectRepository projects;
  private final ApplicationEventPublisher events;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  public ProjectService(ProjectRepository projects, ApplicationEventPublisher events, Clock clock) {
    this.projects = projects;
    this.events = events;
    this.clock = clock;
  }

  @Transactional
  public Project create(UUID ownerId, CreateProjectCommand command) {
    RepoRef repo = new RepoRef(command.repoOwner(), command.repoName());
    Slug slug = chooseSlug(command);
    return projects.save(
        new Project(ownerId, command.name(), slug, repo, command.settings(), clock.instant()));
  }

  @Transactional(readOnly = true)
  public Page<Project> list(UUID ownerId, Pageable pageable) {
    return projects.findAllOwned(ownerId, pageable);
  }

  @Transactional(readOnly = true)
  public Project get(UUID ownerId, UUID projectId) {
    return projects
        .findOwned(projectId, ownerId)
        .orElseThrow(() -> new NotFoundException("Project", projectId));
  }

  /** Partial update: only non-null fields of the command change. */
  @Transactional
  public Project update(UUID ownerId, UUID projectId, UpdateProjectCommand command) {
    Project project = get(ownerId, projectId);
    var now = clock.instant();
    if (command.name() != null) {
      project.rename(command.name(), now);
    }
    if (command.repoOwner() != null || command.repoName() != null) {
      var current = project.snapshot();
      project.changeRepository(
          new RepoRef(
              coalesce(command.repoOwner(), current.repoOwner()),
              coalesce(command.repoName(), current.repoName())),
          now);
    }
    BuildSettings current = project.buildSettings();
    project.changeBuildSettings(
        new BuildSettings(
            coalesce(command.branch(), current.branch()),
            coalesce(command.rootDir(), current.rootDir()),
            coalesce(command.buildType(), current.buildType()),
            coalesce(command.port(), current.port()),
            coalesce(command.healthCheckPath(), current.healthCheckPath()),
            coalesce(command.autoDeploy(), current.autoDeploy())),
        now);
    RunSettings run = project.runSettings();
    project.changeRunSettings(
        new RunSettings(
            coalesce(command.replicas(), run.replicas()),
            coalesce(command.rollout(), run.rollout())),
        now);
    return project;
  }

  /**
   * Publishes {@link ProjectDeleting} first (synchronously, same transaction) so running containers
   * are stopped before the rows disappear.
   */
  @Transactional
  public void delete(UUID ownerId, UUID projectId) {
    Project project = get(ownerId, projectId);
    events.publishEvent(new ProjectDeleting(project.id(), project.slug()));
    project.markLive(null, clock.instant());
    projects.flush();
    projects.delete(project);
  }

  private Slug chooseSlug(CreateProjectCommand command) {
    if (command.slug() != null && !command.slug().isBlank()) {
      Slug requested = new Slug(command.slug());
      if (projects.existsBySlug(requested.value())) {
        throw new ForgeException(
            ErrorCode.SLUG_TAKEN, "Slug '" + requested.value() + "' is already taken");
      }
      return requested;
    }
    Slug generated = Slug.fromName(command.name());
    while (projects.existsBySlug(generated.value())) {
      byte[] suffix = new byte[2];
      random.nextBytes(suffix);
      generated = Slug.fromName(command.name()).withSuffix(HexFormat.of().formatHex(suffix));
    }
    return generated;
  }

  private static <T> T coalesce(T value, T fallback) {
    return value != null ? value : fallback;
  }
}
