package com.forge.deployment.application;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentTrigger;
import com.forge.deployment.FailureReason;
import com.forge.deployment.domain.Deployment;
import com.forge.deployment.domain.RuntimeInstanceRecord;
import com.forge.deployment.infrastructure.DeploymentRepository;
import com.forge.deployment.infrastructure.RuntimeInstanceRepository;
import com.forge.jobs.JobPostponedException;
import com.forge.jobs.JobQueue;
import com.forge.jobs.JobType;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.RunningInstance;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.shared.error.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every change to a deployment's state, each in its own short transaction (load → call a domain
 * method → save). The pipeline does slow work (git, docker, health checks) <em>between</em> these
 * calls, never inside a transaction, so no database connection is held for minutes.
 */
@Service
public class DeploymentTransitions {

  private final DeploymentRepository deployments;
  private final RuntimeInstanceRepository instances;
  private final JobQueue jobs;
  private final ProjectCatalog projects;
  private final DeploymentProperties properties;
  private final Clock clock;

  public DeploymentTransitions(
      DeploymentRepository deployments,
      RuntimeInstanceRepository instances,
      JobQueue jobs,
      ProjectCatalog projects,
      DeploymentProperties properties,
      Clock clock) {
    this.deployments = deployments;
    this.instances = instances;
    this.jobs = jobs;
    this.projects = projects;
    this.properties = properties;
    this.clock = clock;
  }

  /**
   * Creates a QUEUED deployment and its BUILD job atomically. Older deployments of the project that
   * are still waiting are cancelled: only the newest commit is worth building.
   */
  @Transactional
  public Deployment queue(
      ProjectSnapshot project,
      String commitSha,
      String commitMessage,
      DeploymentTrigger trigger,
      UUID triggeredBy) {
    Deployment deployment =
        Deployment.request(project.id(), commitSha, commitMessage, trigger, triggeredBy, now());
    supersedeQueued(project.id(), deployment.id());
    deployments.save(deployment);
    jobs.enqueue(JobType.BUILD, new BuildJobPayload(deployment.id()), "build:" + deployment.id());
    return deployment;
  }

  /** Creates a ROLLBACK deployment and goes straight to a DEPLOY job: nothing to build. */
  @Transactional
  public Deployment queueRollback(UUID targetId, UUID triggeredBy) {
    Deployment target = load(targetId);
    Deployment rollback = Deployment.rollbackTo(target, triggeredBy, now());
    supersedeQueued(target.projectId(), rollback.id());
    deployments.save(rollback);
    jobs.enqueue(JobType.DEPLOY, new DeployJobPayload(rollback.id()), "deploy:" + rollback.id());
    return rollback;
  }

  /**
   * QUEUED → BUILDING. Returns empty if the deployment was cancelled while waiting.
   *
   * <p>If it is already BUILDING, this is a retry of our own job after a worker crash (each
   * deployment has exactly one BUILD job), so the build simply starts again.
   *
   * @throws JobPostponedException if another deployment of the project is still in progress
   */
  @Transactional
  public Optional<Deployment> beginBuild(UUID id) {
    Deployment deployment = load(id);
    if (deployment.status() == DeploymentStatus.BUILDING) {
      return Optional.of(deployment);
    }
    if (deployment.status() != DeploymentStatus.QUEUED) {
      return Optional.empty();
    }
    waitIfProjectBusy(deployment);
    deployment.startBuild(now());
    // saveAndFlush so the partial unique index (one in-progress deployment per project) is checked
    // now, inside this method, rather than at some later commit.
    return Optional.of(deployments.saveAndFlush(deployment));
  }

  /**
   * BUILDING → DEPLOYING and queue the DEPLOY job, in one transaction. Returns false if the
   * deployment was cancelled while it was building.
   */
  @Transactional
  public boolean completeBuild(UUID id, String imageRef, String commitMessage) {
    Deployment deployment = load(id);
    if (deployment.status() != DeploymentStatus.BUILDING) {
      return false;
    }
    deployment.buildSucceeded(imageRef, commitMessage, now());
    deployments.save(deployment);
    jobs.enqueue(JobType.DEPLOY, new DeployJobPayload(id), "deploy:" + id);
    return true;
  }

  /**
   * Prepares the deploy step. Normal deployments are already DEPLOYING; rollbacks move QUEUED →
   * DEPLOYING here. A retried job may find HEALTH_CHECKING and simply starts over.
   */
  @Transactional
  public Optional<Deployment> beginDeploy(UUID id) {
    Deployment deployment = load(id);
    switch (deployment.status()) {
      case QUEUED -> {
        waitIfProjectBusy(deployment);
        deployment.startDeployWithExistingImage(now());
        deployments.saveAndFlush(deployment);
      }
      case DEPLOYING, HEALTH_CHECKING -> {
        // nothing to change
      }
      default -> {
        return Optional.empty();
      }
    }
    return Optional.of(deployment);
  }

  @Transactional
  public void beginHealthCheck(UUID id) {
    Deployment deployment = load(id);
    if (deployment.status() == DeploymentStatus.DEPLOYING) {
      deployment.startHealthCheck(now());
      deployments.save(deployment);
    }
  }

  /** → LIVE; the previously live deployment becomes SUPERSEDED. */
  @Transactional
  public void goLive(UUID id) {
    Deployment deployment = load(id);
    deployment.goLive(now());
    deployments.save(deployment);
    for (Deployment previous :
        deployments.findByProjectAndStatusIn(
            deployment.projectId(), List.of(DeploymentStatus.LIVE))) {
      if (!previous.id().equals(id)) {
        previous.supersede(id, now());
        deployments.save(previous);
      }
    }
    instances.findByDeployment(id).ifPresent(RuntimeInstanceRecord::markRunning);
    projects.recordLiveDeployment(deployment.projectId(), id);
  }

  /** → FAILED, unless the deployment already ended (e.g. it was cancelled meanwhile). */
  @Transactional
  public void fail(UUID id, FailureReason reason, String detail) {
    Deployment deployment = load(id);
    if (deployment.status().canTransitionTo(DeploymentStatus.FAILED)) {
      deployment.fail(reason, detail, now());
      deployments.save(deployment);
    }
  }

  @Transactional
  public Deployment cancel(UUID id) {
    Deployment deployment = load(id);
    if (!deployment.isCancellable()) {
      throw new ForgeException(
          ErrorCode.NOT_CANCELLABLE,
          "Deployment is " + deployment.status() + " and can no longer be cancelled");
    }
    deployment.cancel("Cancelled by user", now());
    return deployments.save(deployment);
  }

  /** LIVE → STOPPED, used when a project's app is taken down. */
  @Transactional
  public void stopLive(UUID projectId) {
    for (Deployment live :
        deployments.findByProjectAndStatusIn(projectId, List.of(DeploymentStatus.LIVE))) {
      live.stop(now());
      deployments.save(live);
    }
  }

  @Transactional
  public void recordInstance(UUID deploymentId, RunningInstance instance) {
    instances
        .findByDeployment(deploymentId)
        .ifPresentOrElse(
            existing ->
                existing.replaceContainer(instance.instanceId(), instance.probeUrl().toString()),
            () ->
                instances.save(
                    new RuntimeInstanceRecord(
                        deploymentId,
                        instance.instanceId(),
                        instance.probeUrl().toString(),
                        now())));
  }

  @Transactional
  public void markInstanceStopped(UUID deploymentId) {
    instances.findByDeployment(deploymentId).ifPresent(r -> r.markStopped(now()));
  }

  @Transactional(readOnly = true)
  public Optional<RuntimeInstanceRecord> instanceOf(UUID deploymentId) {
    return instances.findByDeployment(deploymentId);
  }

  @Transactional(readOnly = true)
  public List<RuntimeInstanceRecord> activeInstances(UUID projectId) {
    return instances.findActiveByProject(projectId);
  }

  private void waitIfProjectBusy(Deployment deployment) {
    if (deployments.anotherInProgress(deployment.projectId(), deployment.id())) {
      throw new JobPostponedException(
          "Another deployment of this project is in progress", properties.busyRetryDelay());
    }
  }

  private void supersedeQueued(UUID projectId, UUID newerId) {
    for (Deployment waiting :
        deployments.findByProjectAndStatusIn(projectId, List.of(DeploymentStatus.QUEUED))) {
      waiting.cancel("Superseded by newer deployment " + newerId, now());
      deployments.save(waiting);
    }
  }

  Deployment load(UUID id) {
    return deployments.findById(id).orElseThrow(() -> new NotFoundException("Deployment", id));
  }

  private Instant now() {
    return clock.instant();
  }
}
