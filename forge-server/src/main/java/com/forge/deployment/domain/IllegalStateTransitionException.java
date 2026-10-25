package com.forge.deployment.domain;

import com.forge.deployment.DeploymentStatus;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import java.util.UUID;

/** Someone tried to move a deployment along an edge the state machine does not have. */
public class IllegalStateTransitionException extends ForgeException {

  public IllegalStateTransitionException(UUID id, DeploymentStatus from, DeploymentStatus to) {
    super(
        ErrorCode.ILLEGAL_STATE_TRANSITION,
        "Deployment " + id + " cannot go from " + from + " to " + to);
  }
}
