package com.forge.agent.application;

import com.forge.agent.domain.Insight;
import com.forge.agent.infrastructure.InsightRepository;
import com.forge.deployment.DeploymentQueries;
import com.forge.shared.error.NotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read access to the agent's insights, with the same ownership rule as deployments. */
@Service
public class InsightService {

  private final InsightRepository insights;
  private final DeploymentQueries deployments;

  public InsightService(InsightRepository insights, DeploymentQueries deployments) {
    this.insights = insights;
    this.deployments = deployments;
  }

  @Transactional(readOnly = true)
  public Insight getOwned(UUID deploymentId, UUID userId) {
    deployments.getOwned(deploymentId, userId);
    return insights
        .findById(deploymentId)
        .orElseThrow(() -> new NotFoundException("Insight", deploymentId));
  }
}
