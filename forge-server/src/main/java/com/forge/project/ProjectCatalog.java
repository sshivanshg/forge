package com.forge.project;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Public API of the project module, used by the deployment, notification and agent modules. They
 * never touch the project tables or entities directly.
 */
public interface ProjectCatalog {

  /**
   * @throws com.forge.shared.error.NotFoundException if missing or not owned by {@code ownerId}
   */
  ProjectSnapshot getOwned(UUID projectId, UUID ownerId);

  /**
   * @throws com.forge.shared.error.NotFoundException if missing
   */
  ProjectSnapshot get(UUID projectId);

  /** Projects that should deploy automatically when this repository branch receives a push. */
  List<ProjectSnapshot> findAutoDeployTargets(String repoOwner, String repoName, String branch);

  /** Decrypted environment variables. Only called right before a container starts. */
  Map<String, String> environmentOf(UUID projectId);

  /** Called by the deployment pipeline when a deployment of this project goes live. */
  void recordLiveDeployment(UUID projectId, UUID deploymentId);
}
