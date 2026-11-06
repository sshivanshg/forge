package com.forge.project.api;

import com.forge.build.BuildType;
import com.forge.project.ProjectSnapshot;
import com.forge.project.RolloutMode;
import com.forge.project.application.CreateProjectCommand;
import com.forge.project.application.ProjectService;
import com.forge.project.application.UpdateProjectCommand;
import com.forge.project.domain.BuildSettings;
import com.forge.project.domain.Project;
import com.forge.shared.config.AppUrls;
import com.forge.shared.security.AuthenticatedUser;
import com.forge.shared.web.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
class ProjectController {

  private final ProjectService projects;
  private final AppUrls appUrls;

  ProjectController(ProjectService projects, AppUrls appUrls) {
    this.projects = projects;
    this.appUrls = appUrls;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  ProjectResponse create(
      @AuthenticationPrincipal AuthenticatedUser user,
      @Valid @RequestBody CreateProjectRequest request) {
    var defaults = BuildSettings.defaults();
    var settings =
        new BuildSettings(
            request.branch() != null ? request.branch() : defaults.branch(),
            request.rootDir(),
            request.buildType(),
            request.port() != null ? request.port() : defaults.port(),
            request.healthCheckPath() != null
                ? request.healthCheckPath()
                : defaults.healthCheckPath(),
            request.autoDeploy() != null ? request.autoDeploy() : defaults.autoDeploy());
    var command =
        new CreateProjectCommand(
            request.name(), request.slug(), request.repoOwner(), request.repoName(), settings);
    return toResponse(projects.create(user.id(), command));
  }

  @GetMapping
  PageResponse<ProjectResponse> list(
      @AuthenticationPrincipal AuthenticatedUser user,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    var pageable = PageRequest.of(page, Math.min(size, 100), Sort.by("createdAt").descending());
    return PageResponse.from(projects.list(user.id(), pageable), this::toResponse);
  }

  @GetMapping("/{id}")
  ProjectResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return toResponse(projects.get(user.id(), id));
  }

  @PatchMapping("/{id}")
  ProjectResponse update(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @Valid @RequestBody UpdateProjectRequest r) {
    var command =
        new UpdateProjectCommand(
            r.name(),
            r.repoOwner(),
            r.repoName(),
            r.branch(),
            r.rootDir(),
            r.buildType(),
            r.port(),
            r.healthCheckPath(),
            r.autoDeploy(),
            r.replicas(),
            r.rollout());
    return toResponse(projects.update(user.id(), id, command));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    projects.delete(user.id(), id);
  }

  private ProjectResponse toResponse(Project project) {
    ProjectSnapshot p = project.snapshot();
    return new ProjectResponse(
        p.id(),
        p.name(),
        p.slug(),
        p.repoOwner(),
        p.repoName(),
        "https://github.com/" + p.repoOwner() + "/" + p.repoName(),
        p.branch(),
        p.rootDir(),
        p.buildType(),
        p.port(),
        p.healthCheckPath(),
        p.autoDeploy(),
        p.replicas(),
        p.rollout(),
        appUrls.urlFor(p.slug()),
        p.liveDeploymentId(),
        project.createdAt(),
        project.updatedAt());
  }

  record CreateProjectRequest(
      @NotBlank @Size(max = 100) String name,
      @Size(max = 63) String slug,
      @NotBlank String repoOwner,
      @NotBlank String repoName,
      String branch,
      String rootDir,
      BuildType buildType,
      @Min(1) @Max(65535) Integer port,
      String healthCheckPath,
      Boolean autoDeploy) {}

  record UpdateProjectRequest(
      @Size(min = 1, max = 100) String name,
      String repoOwner,
      String repoName,
      String branch,
      String rootDir,
      BuildType buildType,
      @Min(1) @Max(65535) Integer port,
      String healthCheckPath,
      Boolean autoDeploy,
      @Min(1) @Max(3) Integer replicas,
      RolloutMode rollout) {}

  record ProjectResponse(
      UUID id,
      String name,
      String slug,
      String repoOwner,
      String repoName,
      String repoUrl,
      String branch,
      String rootDir,
      BuildType buildType,
      int port,
      String healthCheckPath,
      boolean autoDeploy,
      int replicas,
      RolloutMode rollout,
      String liveUrl,
      UUID liveDeploymentId,
      Instant createdAt,
      Instant updatedAt) {}
}
