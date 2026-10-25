package com.forge.deployment.application;

import com.forge.deployment.DeploymentTrigger;
import com.forge.deployment.DeploymentView;
import com.forge.deployment.domain.Deployment;
import com.forge.deployment.domain.RuntimeInstanceRecord;
import com.forge.deployment.infrastructure.DeploymentRepository;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectDeleting;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.RuntimeProvider;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.source.GitHubAccounts;
import com.forge.source.GitPushReceived;
import com.forge.source.GitRepository;
import com.forge.source.SourceCodeProvider;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deployment use cases (Facade over the pipeline): request, cancel, roll back, list. Also reacts to
 * git pushes and project deletion.
 */
@Service
public class DeploymentService {

  private static final Logger log = LoggerFactory.getLogger(DeploymentService.class);
  private static final Pattern SHA = Pattern.compile("^[0-9a-f]{40}$");

  private final DeploymentTransitions transitions;
  private final DeploymentRepository deployments;
  private final DeploymentQueryService queries;
  private final ProjectCatalog projects;
  private final SourceCodeProvider source;
  private final GitHubAccounts gitHub;
  private final RuntimeProvider runtime;

  public DeploymentService(
      DeploymentTransitions transitions,
      DeploymentRepository deployments,
      DeploymentQueryService queries,
      ProjectCatalog projects,
      SourceCodeProvider source,
      GitHubAccounts gitHub,
      RuntimeProvider runtime) {
    this.transitions = transitions;
    this.deployments = deployments;
    this.queries = queries;
    this.projects = projects;
    this.source = source;
    this.gitHub = gitHub;
    this.runtime = runtime;
  }

  /**
   * Manual deploy. Pins the commit first (resolving the branch head over the network, outside any
   * transaction), then records the deployment and its job atomically.
   */
  public DeploymentView request(UUID projectId, UUID userId, String commitSha) {
    ProjectSnapshot project = projects.getOwned(projectId, userId);
    String sha;
    if (commitSha != null && !commitSha.isBlank()) {
      sha = commitSha.strip().toLowerCase();
      if (!SHA.matcher(sha).matches()) {
        throw new ForgeException(
            ErrorCode.VALIDATION_FAILED, "commitSha must be a full 40-character SHA");
      }
    } else {
      sha =
          source.resolveHead(
              new GitRepository(project.repoOwner(), project.repoName()),
              project.branch(),
              gitHub.accessTokenFor(project.ownerId()));
    }
    Deployment deployment = transitions.queue(project, sha, null, DeploymentTrigger.MANUAL, userId);
    return queries.toView(deployment, false);
  }

  public DeploymentView cancel(UUID deploymentId, UUID userId) {
    queries.getOwned(deploymentId, userId);
    return queries.toView(transitions.cancel(deploymentId), false);
  }

  public DeploymentView rollback(UUID targetId, UUID userId) {
    DeploymentView target = queries.getOwned(targetId, userId);
    if (target.imageRef() == null) {
      throw new ForgeException(
          ErrorCode.NOT_ROLLBACKABLE, "This deployment never produced an image");
    }
    try {
      return queries.toView(transitions.queueRollback(targetId, userId), false);
    } catch (com.forge.shared.error.ValidationException e) {
      throw new ForgeException(ErrorCode.NOT_ROLLBACKABLE, e.getMessage());
    }
  }

  @Transactional(readOnly = true)
  public Page<DeploymentView> history(UUID projectId, UUID userId, Pageable pageable) {
    projects.getOwned(projectId, userId);
    return deployments.findByProject(projectId, pageable).map(d -> queries.toView(d, false));
  }

  /**
   * A verified push arrived: queue a deployment for every auto-deploy project on that branch. Runs
   * synchronously inside the webhook's transaction, so the delivery is only recorded as processed
   * if the deployments were queued too.
   */
  @EventListener
  public void onPush(GitPushReceived push) {
    for (ProjectSnapshot project :
        projects.findAutoDeployTargets(push.repoOwner(), push.repoName(), push.branch())) {
      Deployment deployment =
          transitions.queue(
              project, push.commitSha(), push.commitMessage(), DeploymentTrigger.WEBHOOK, null);
      log.info("Push queued deployment {} for project {}", deployment.id(), project.slug());
    }
  }

  /** Stop the project's containers before its rows are deleted. */
  @EventListener
  public void onProjectDeleting(ProjectDeleting event) {
    for (RuntimeInstanceRecord instance : transitions.activeInstances(event.projectId())) {
      runtime.stop(instance.externalId());
    }
  }
}
