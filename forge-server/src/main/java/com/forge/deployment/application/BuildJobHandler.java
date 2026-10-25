package com.forge.deployment.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.build.BuildFailedException;
import com.forge.build.BuildRequest;
import com.forge.build.BuildResult;
import com.forge.build.BuildService;
import com.forge.deployment.FailureReason;
import com.forge.deployment.domain.Deployment;
import com.forge.jobs.AbstractJobHandler;
import com.forge.jobs.Job;
import com.forge.jobs.JobPostponedException;
import com.forge.jobs.JobType;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.source.GitHubAccounts;
import com.forge.source.GitRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/** Executes BUILD jobs: QUEUED → BUILDING → (image pushed) → DEPLOYING, or FAILED. */
@Component
class BuildJobHandler extends AbstractJobHandler<BuildJobPayload> {

  private final DeploymentTransitions transitions;
  private final ProjectCatalog projects;
  private final GitHubAccounts gitHub;
  private final BuildService builds;
  private final LogSink logs;
  private final DeploymentProperties properties;

  BuildJobHandler(
      DeploymentTransitions transitions,
      ProjectCatalog projects,
      GitHubAccounts gitHub,
      BuildService builds,
      LogSink logs,
      DeploymentProperties properties,
      ObjectMapper objectMapper,
      MeterRegistry meters) {
    super(BuildJobPayload.class, objectMapper, meters);
    this.transitions = transitions;
    this.projects = projects;
    this.gitHub = gitHub;
    this.builds = builds;
    this.logs = logs;
    this.properties = properties;
  }

  @Override
  public JobType type() {
    return JobType.BUILD;
  }

  @Override
  protected void doHandle(BuildJobPayload payload, Job job) {
    Optional<Deployment> started;
    try {
      started = transitions.beginBuild(payload.deploymentId());
    } catch (DataIntegrityViolationException raceLostToAnotherWorker) {
      throw new JobPostponedException("Project busy", properties.busyRetryDelay());
    }
    if (started.isEmpty()) {
      return; // cancelled or superseded while it waited in the queue
    }
    Deployment deployment = started.get();
    ProjectSnapshot project = projects.get(deployment.projectId());
    BuildRequest request =
        new BuildRequest(
            deployment.id(),
            project.slug(),
            new GitRepository(project.repoOwner(), project.repoName()),
            project.branch(),
            deployment.commitSha(),
            gitHub.accessTokenFor(project.ownerId()),
            project.rootDir(),
            project.buildType(),
            project.port());
    BuildResult result;
    try {
      result = builds.build(request);
    } catch (BuildFailedException e) {
      logs.append(deployment.id(), LogSource.SYSTEM, "✖ " + e.getMessage());
      transitions.fail(deployment.id(), toFailureReason(e.reason()), e.getMessage());
      return; // the job itself succeeded: it recorded the failure
    }
    if (!transitions.completeBuild(deployment.id(), result.imageRef(), result.commit().message())) {
      logs.append(
          deployment.id(),
          LogSource.SYSTEM,
          "Deployment was cancelled during the build; image discarded");
    }
  }

  @Override
  protected void onFailedPermanently(BuildJobPayload payload, Throwable error) {
    transitions.fail(payload.deploymentId(), FailureReason.INTERNAL_ERROR, error.getMessage());
  }

  static FailureReason toFailureReason(BuildFailedException.Reason reason) {
    return switch (reason) {
      case SOURCE_UNAVAILABLE -> FailureReason.SOURCE_UNAVAILABLE;
      case UNSUPPORTED_PROJECT -> FailureReason.UNSUPPORTED_PROJECT;
      case BUILD_FAILED -> FailureReason.BUILD_FAILED;
      case BUILD_TIMEOUT -> FailureReason.BUILD_TIMEOUT;
      case PUSH_FAILED -> FailureReason.PUSH_FAILED;
    };
  }
}
