package com.forge.deployment.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.deployment.DeploymentStatus;
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
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/** Executes DEPLOY jobs by delegating to the {@link RolloutStrategy} the selector picks. */
@Component
class DeployJobHandler extends AbstractJobHandler<DeployJobPayload> {

  private final DeploymentTransitions transitions;
  private final ProjectCatalog projects;
  private final RolloutSelector selector;
  private final CanaryRollout canary;
  private final LogSink logs;
  private final DeploymentProperties properties;

  DeployJobHandler(
      DeploymentTransitions transitions,
      ProjectCatalog projects,
      RolloutSelector selector,
      CanaryRollout canary,
      LogSink logs,
      DeploymentProperties properties,
      ObjectMapper objectMapper,
      MeterRegistry meters) {
    super(DeployJobPayload.class, objectMapper, meters);
    this.transitions = transitions;
    this.projects = projects;
    this.selector = selector;
    this.canary = canary;
    this.logs = logs;
    this.properties = properties;
  }

  @Override
  public JobType type() {
    return JobType.DEPLOY;
  }

  @Override
  protected void doHandle(DeployJobPayload payload, Job job) {
    Optional<Deployment> ready;
    try {
      ready = transitions.beginDeploy(payload.deploymentId());
    } catch (DataIntegrityViolationException raceLostToAnotherWorker) {
      throw new JobPostponedException("Project busy", properties.busyRetryDelay());
    }
    if (ready.isEmpty()) {
      return;
    }
    Deployment deployment = ready.get();
    ProjectSnapshot project = projects.get(deployment.projectId());
    RolloutContext context =
        new RolloutContext(
            deployment.id(), deployment.imageRef(), project, projects.environmentOf(project.id()));
    if (deployment.status() == DeploymentStatus.CANARY) {
      canary.abandon(context);
      return;
    }
    RolloutSelector.Choice choice = selector.select(deployment, project);
    choice
        .fallbackReason()
        .ifPresent(reason -> logs.append(deployment.id(), LogSource.DEPLOY, "▶ " + reason));
    choice.strategy().rollout(context);
  }

  @Override
  protected void onFailedPermanently(DeployJobPayload payload, Throwable error) {
    transitions.fail(payload.deploymentId(), FailureReason.RUNTIME_ERROR, error.getMessage());
  }
}
