package com.forge.agent.application;

import com.forge.agent.domain.AgentAction;
import com.forge.agent.domain.SettingsPatch;
import com.forge.deployment.DeploymentCommands;
import com.forge.deployment.DeploymentView;
import com.forge.project.ProjectSettings;
import com.forge.project.SettingsChange;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Turns an approved action into calls on the deployment and project modules' public APIs. Every
 * call runs with the approving owner's identity, so it gets the same ownership checks, validation
 * and state machine as a click in the dashboard: the agent gains no extra power.
 */
@Component
class ActionExecutor {

  private final DeploymentCommands deployments;
  private final ProjectSettings settings;

  ActionExecutor(DeploymentCommands deployments, ProjectSettings settings) {
    this.deployments = deployments;
    this.settings = settings;
  }

  /** Runs the action and returns the deployment it started. */
  DeploymentView execute(AgentAction action, UUID ownerId) {
    return switch (action.type()) {
      case ROLLBACK -> deployments.rollback(action.targetDeploymentId(), ownerId);
      case REDEPLOY -> deployments.request(action.projectId(), ownerId, action.commitSha());
      case SCALE_OUT, UPDATE_SETTINGS -> {
        settings.apply(action.projectId(), ownerId, toChange(action.settings()));
        // New settings only take effect on a new deployment.
        yield deployments.request(action.projectId(), ownerId, action.commitSha());
      }
    };
  }

  private static SettingsChange toChange(SettingsPatch patch) {
    return new SettingsChange(
        patch.rootDir(),
        patch.buildType(),
        patch.port(),
        patch.healthCheckPath(),
        patch.replicas());
  }
}
