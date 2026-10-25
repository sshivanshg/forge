package com.forge.deployment;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * The deployment lifecycle as a state machine (State pattern via an enum). The table below is the
 * single source of truth for legal transitions; {@code Deployment.transitionTo} refuses anything
 * else.
 *
 * <pre>
 * QUEUED → BUILDING → DEPLOYING → HEALTH_CHECKING → LIVE → SUPERSEDED | STOPPED
 *    │         │           │              │
 *    │         └→ FAILED ←─┴──────────────┘
 *    ├→ DEPLOYING (rollback: the image already exists)
 *    └→ CANCELLED (also from BUILDING)
 * </pre>
 */
public enum DeploymentStatus {
  QUEUED,
  BUILDING,
  DEPLOYING,
  HEALTH_CHECKING,
  LIVE,
  FAILED,
  CANCELLED,
  SUPERSEDED,
  STOPPED;

  private static final Map<DeploymentStatus, Set<DeploymentStatus>> ALLOWED =
      Map.of(
          QUEUED, EnumSet.of(BUILDING, DEPLOYING, CANCELLED),
          BUILDING, EnumSet.of(DEPLOYING, FAILED, CANCELLED),
          DEPLOYING, EnumSet.of(HEALTH_CHECKING, FAILED),
          HEALTH_CHECKING, EnumSet.of(LIVE, FAILED),
          LIVE, EnumSet.of(SUPERSEDED, STOPPED),
          FAILED, EnumSet.noneOf(DeploymentStatus.class),
          CANCELLED, EnumSet.noneOf(DeploymentStatus.class),
          SUPERSEDED, EnumSet.noneOf(DeploymentStatus.class),
          STOPPED, EnumSet.noneOf(DeploymentStatus.class));

  public boolean canTransitionTo(DeploymentStatus next) {
    return ALLOWED.get(this).contains(next);
  }

  /** No transition leaves a terminal state. */
  public boolean isTerminal() {
    return ALLOWED.get(this).isEmpty();
  }

  /** Statuses in which the deployment occupies the project's pipeline. */
  public boolean isInProgress() {
    return this == BUILDING || this == DEPLOYING || this == HEALTH_CHECKING;
  }
}
