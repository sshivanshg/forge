package com.forge.deployment;

import java.util.List;
import java.util.UUID;

/**
 * Public write API of the deployment module for other modules (the agent's approved actions). Each
 * call goes through the same state machine and ownership checks as the REST API.
 */
public interface DeploymentCommands {

  /** Queue a deployment of {@code commitSha}, or of the branch head when null. */
  DeploymentView request(UUID projectId, UUID userId, String commitSha);

  /** Queue a rollback to the image of {@code targetId}, skipping the build. */
  DeploymentView rollback(UUID targetId, UUID userId);

  /** The project's newest deployments, newest first, without timelines. */
  List<DeploymentView> recent(UUID projectId, int limit);
}
