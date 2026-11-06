package com.forge.deployment.application;

import com.forge.deployment.DeploymentQueries;
import com.forge.deployment.DeploymentView;
import com.forge.deployment.DeploymentView.TimelineEntry;
import com.forge.deployment.domain.Deployment;
import com.forge.deployment.infrastructure.DeploymentEventRepository;
import com.forge.deployment.infrastructure.DeploymentRepository;
import com.forge.project.ProjectCatalog;
import com.forge.shared.error.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read side: builds {@link DeploymentView}s and enforces ownership on reads. */
@Service
public class DeploymentQueryService implements DeploymentQueries {

  private final DeploymentRepository deployments;
  private final DeploymentEventRepository events;
  private final ProjectCatalog projects;

  public DeploymentQueryService(
      DeploymentRepository deployments, DeploymentEventRepository events, ProjectCatalog projects) {
    this.deployments = deployments;
    this.events = events;
    this.projects = projects;
  }

  @Override
  @Transactional(readOnly = true)
  public DeploymentView get(UUID deploymentId) {
    return toView(load(deploymentId), true);
  }

  @Override
  @Transactional(readOnly = true)
  public DeploymentView getOwned(UUID deploymentId, UUID userId) {
    Deployment deployment = load(deploymentId);
    try {
      projects.getOwned(deployment.projectId(), userId);
    } catch (NotFoundException notYours) {
      throw new NotFoundException("Deployment", deploymentId); // don't reveal that it exists
    }
    return toView(deployment, true);
  }

  DeploymentView toView(Deployment d, boolean withTimeline) {
    List<TimelineEntry> timeline =
        withTimeline
            ? events.findTimeline(d.id()).stream()
                .map(
                    e ->
                        new TimelineEntry(
                            e.fromStatus(), e.toStatus(), e.message(), e.occurredAt()))
                .toList()
            : null;
    return new DeploymentView(
        d.id(),
        d.projectId(),
        d.commitSha(),
        d.commitMessage(),
        d.trigger(),
        d.status(),
        d.trafficPercent(),
        d.failureReason(),
        d.failureDetail(),
        d.imageRef(),
        d.rollbackOfId(),
        d.createdAt(),
        d.startedAt(),
        d.finishedAt(),
        timeline);
  }

  private Deployment load(UUID id) {
    return deployments.findById(id).orElseThrow(() -> new NotFoundException("Deployment", id));
  }
}
