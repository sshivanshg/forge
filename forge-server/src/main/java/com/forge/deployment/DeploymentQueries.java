package com.forge.deployment;

import java.util.UUID;

/** Public read API of the deployment module. */
public interface DeploymentQueries {

  /** Including the status timeline. */
  DeploymentView get(UUID deploymentId);

  /**
   * @throws com.forge.shared.error.NotFoundException unless the deployment's project belongs to
   *     {@code userId}
   */
  DeploymentView getOwned(UUID deploymentId, UUID userId);
}
