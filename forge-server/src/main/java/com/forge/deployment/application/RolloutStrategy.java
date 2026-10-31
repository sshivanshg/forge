package com.forge.deployment.application;

import com.forge.project.ProjectSnapshot;
import java.util.Map;
import java.util.UUID;

/**
 * Strategy for replacing the running version of an app with a new one: {@link BlueGreenRollout}
 * (all traffic at once) or {@link CanaryRollout} (traffic in steps, judged on live metrics). {@link
 * RolloutSelector} picks one per deployment.
 */
public interface RolloutStrategy {

  /**
   * Starts the new version and either makes it LIVE or marks the deployment FAILED. Must never take
   * the currently live version down unless the new one is healthy.
   */
  void rollout(RolloutContext context);
}

/** Everything a rollout needs. */
record RolloutContext(
    UUID deploymentId, String imageRef, ProjectSnapshot project, Map<String, String> environment) {}
