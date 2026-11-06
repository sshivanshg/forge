package com.forge.deployment.application;

import com.forge.deployment.DeploymentTrigger;
import com.forge.deployment.domain.Deployment;
import com.forge.project.ProjectSnapshot;
import com.forge.project.RolloutMode;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Picks the {@link RolloutStrategy} for one deployment. A project asks for canary rollouts, but a
 * canary only makes sense for new code replacing a live version:
 *
 * <ul>
 *   <li>a rollback or recovery restores a version that already ran: switch at once (blue-green)
 *   <li>a first deployment has nothing to compare with
 *   <li>an engine that cannot split traffic (Docker labels) falls back to blue-green
 * </ul>
 */
@Component
class RolloutSelector {

  /** The chosen strategy, and why the project's preferred one was not used (if it wasn't). */
  record Choice(RolloutStrategy strategy, Optional<String> fallbackReason) {}

  private final BlueGreenRollout blueGreen;
  private final CanaryRollout canary;

  RolloutSelector(BlueGreenRollout blueGreen, CanaryRollout canary) {
    this.blueGreen = blueGreen;
    this.canary = canary;
  }

  Choice select(Deployment deployment, ProjectSnapshot project) {
    if (project.rollout() != RolloutMode.CANARY) {
      return new Choice(blueGreen, Optional.empty());
    }
    if (deployment.trigger() == DeploymentTrigger.ROLLBACK
        || deployment.trigger() == DeploymentTrigger.RECOVERY) {
      return fallback("a " + deployment.trigger().name().toLowerCase() + " switches at once");
    }
    if (project.liveDeploymentId() == null) {
      return fallback("there is no live version to compare with yet");
    }
    if (!canary.available()) {
      return fallback("this engine cannot split traffic");
    }
    return new Choice(canary, Optional.empty());
  }

  private Choice fallback(String reason) {
    return new Choice(blueGreen, Optional.of("Blue-green instead of canary: " + reason));
  }
}
