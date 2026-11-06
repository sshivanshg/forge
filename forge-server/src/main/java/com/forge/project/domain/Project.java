package com.forge.project.domain;

import com.forge.build.BuildType;
import com.forge.project.ProjectSnapshot;
import com.forge.project.RolloutMode;
import com.forge.shared.error.ValidationException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Aggregate root: an app the user wants Forge to deploy. All mutations go through intent-revealing
 * methods that validate their input, so a Project can never hold an invalid configuration.
 */
@Entity
@Table(name = "projects")
public class Project {

  @Id private UUID id;

  @Column(name = "owner_id", nullable = false)
  private UUID ownerId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, unique = true)
  private String slug;

  @Column(name = "repo_owner", nullable = false)
  private String repoOwner;

  @Column(name = "repo_name", nullable = false)
  private String repoName;

  @Column(nullable = false)
  private String branch;

  @Column(name = "root_dir", nullable = false)
  private String rootDir;

  @Enumerated(EnumType.STRING)
  @Column(name = "build_type", nullable = false)
  private BuildType buildType;

  @Column(nullable = false)
  private int port;

  @Column(name = "health_check_path", nullable = false)
  private String healthCheckPath;

  @Column(name = "auto_deploy", nullable = false)
  private boolean autoDeploy;

  @Column(nullable = false)
  private int replicas;

  @Enumerated(EnumType.STRING)
  @Column(name = "rollout_strategy", nullable = false)
  private RolloutMode rollout;

  @Column(name = "live_deployment_id")
  private UUID liveDeploymentId;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Project() {
    // for JPA
  }

  public Project(
      UUID ownerId, String name, Slug slug, RepoRef repo, BuildSettings settings, Instant now) {
    this.id = UUID.randomUUID();
    this.ownerId = ownerId;
    this.slug = slug.value();
    this.createdAt = now;
    rename(name, now);
    changeRepository(repo, now);
    changeBuildSettings(settings, now);
    changeRunSettings(RunSettings.defaults(), now);
  }

  public void rename(String newName, Instant now) {
    if (newName == null || newName.isBlank() || newName.length() > 100) {
      throw new ValidationException("name must be 1 to 100 characters");
    }
    this.name = newName.strip();
    this.updatedAt = now;
  }

  public void changeRepository(RepoRef repo, Instant now) {
    this.repoOwner = repo.owner();
    this.repoName = repo.name();
    this.updatedAt = now;
  }

  public void changeBuildSettings(BuildSettings settings, Instant now) {
    this.branch = settings.branch();
    this.rootDir = settings.rootDir();
    this.buildType = settings.buildType();
    this.port = settings.port();
    this.healthCheckPath = settings.healthCheckPath();
    this.autoDeploy = settings.autoDeploy();
    this.updatedAt = now;
  }

  /** Takes effect with the next deployment. */
  public void changeRunSettings(RunSettings settings, Instant now) {
    this.replicas = settings.replicas();
    this.rollout = settings.rollout();
    this.updatedAt = now;
  }

  public void markLive(UUID deploymentId, Instant now) {
    this.liveDeploymentId = deploymentId;
    this.updatedAt = now;
  }

  public boolean isOwnedBy(UUID userId) {
    return ownerId.equals(userId);
  }

  public BuildSettings buildSettings() {
    return new BuildSettings(branch, rootDir, buildType, port, healthCheckPath, autoDeploy);
  }

  public RunSettings runSettings() {
    return new RunSettings(replicas, rollout);
  }

  public ProjectSnapshot snapshot() {
    return new ProjectSnapshot(
        id,
        ownerId,
        name,
        slug,
        repoOwner,
        repoName,
        branch,
        rootDir,
        buildType,
        port,
        healthCheckPath,
        autoDeploy,
        replicas,
        rollout,
        liveDeploymentId);
  }

  public UUID id() {
    return id;
  }

  public String slug() {
    return slug;
  }

  public Instant createdAt() {
    return createdAt;
  }

  public Instant updatedAt() {
    return updatedAt;
  }
}
