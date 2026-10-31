package com.forge.deployment.application;

import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Zero-downtime blue-green rollout.
 *
 * <ol>
 *   <li>Start the new version ("green", one instance per replica) next to the live one ("blue").
 *   <li>Health-check green directly, before trusting it with traffic.
 *   <li>Unhealthy → capture its output, remove it, mark the deployment FAILED. Blue was never
 *       touched, so the site stays up.
 *   <li>Healthy → mark LIVE, wait briefly for the proxy, then stop blue.
 * </ol>
 */
@Component
class BlueGreenRollout implements RolloutStrategy {

  private final RolloutSteps steps;
  private final DeploymentTransitions transitions;

  BlueGreenRollout(RolloutSteps steps, DeploymentTransitions transitions) {
    this.steps = steps;
    this.transitions = transitions;
  }

  @Override
  public void rollout(RolloutContext context) {
    UUID id = context.deploymentId();
    if (steps.startHealthy(context).isEmpty()) {
      return;
    }
    transitions.goLive(id);
    steps.retirePreviousVersions(id, context.project());
    steps.announceLive(id, context.project());
  }
}
