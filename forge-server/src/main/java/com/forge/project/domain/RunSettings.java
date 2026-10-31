package com.forge.project.domain;

import com.forge.project.RolloutMode;
import com.forge.shared.error.ValidationException;

/**
 * Value object: how the app runs once built. Validated on construction.
 *
 * @param replicas identical instances behind the load balancer (1 to {@value #MAX_REPLICAS})
 * @param rollout how a new version replaces the live one
 */
public record RunSettings(int replicas, RolloutMode rollout) {

  public static final int MAX_REPLICAS = 3;

  public RunSettings {
    if (replicas < 1 || replicas > MAX_REPLICAS) {
      throw new ValidationException("replicas must be between 1 and " + MAX_REPLICAS);
    }
    if (rollout == null) {
      rollout = RolloutMode.BLUE_GREEN;
    }
  }

  public static RunSettings defaults() {
    return new RunSettings(1, RolloutMode.BLUE_GREEN);
  }
}
