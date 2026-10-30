package com.forge.deployment.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.deployment.FailureReason;
import com.forge.deployment.domain.Deployment;
import com.forge.jobs.AbstractJobHandler;
import com.forge.jobs.Job;
import com.forge.jobs.JobPostponedException;
import com.forge.jobs.JobType;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/** Executes DEPLOY jobs by delegating to the configured {@link RolloutStrategy}. */
@Component
class DeployJobHandler extends AbstractJobHandler<DeployJobPayload> {

  private final DeploymentTransitions transitions;
  private final ProjectCatalog projects;
  private final RolloutStrategy rollout;
  private final DeploymentProperties properties;

  DeployJobHandler(
      DeploymentTransitions transitions,
      ProjectCatalog projects,
      RolloutStrategy rollout,
      DeploymentProperties properties,
      ObjectMapper objectMapper,
      MeterRegistry meters) {
    super(DeployJobPayload.class, objectMapper, meters);
    this.transitions = transitions;
    this.projects = projects;
    this.rollout = rollout;
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
    rollout.rollout(
        new RolloutContext(
            deployment.id(), deployment.imageRef(), project, projects.environmentOf(project.id())));
  }

  @Override
  protected void onFailedPermanently(DeployJobPayload payload, Throwable error) {
    transitions.fail(payload.deploymentId(), FailureReason.RUNTIME_ERROR, error.getMessage());
  }
}
