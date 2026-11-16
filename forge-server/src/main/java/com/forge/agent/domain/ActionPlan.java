package com.forge.agent.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * A change the agent recommends, before it is stored as a proposal. Factory methods keep each
 * type's required fields consistent: a rollback always has a target, a settings change always has a
 * patch.
 */
public record ActionPlan(
    ActionType type,
    String title,
    String rationale,
    UUID targetDeploymentId,
    String commitSha,
    SettingsPatch settings) {

  public ActionPlan {
    Objects.requireNonNull(type, "type");
    Objects.requireNonNull(title, "title");
    rationale = rationale == null ? "" : rationale;
    switch (type) {
      case ROLLBACK -> Objects.requireNonNull(targetDeploymentId, "a rollback needs a target");
      case SCALE_OUT, UPDATE_SETTINGS -> {
        if (settings == null || settings.isEmpty()) {
          throw new IllegalArgumentException(type + " needs settings to change");
        }
      }
      case REDEPLOY -> {
        // commitSha may be null: redeploy the branch head
      }
    }
  }

  public static ActionPlan rollback(UUID target, String title, String rationale) {
    return new ActionPlan(ActionType.ROLLBACK, title, rationale, target, null, null);
  }

  public static ActionPlan redeploy(String commitSha, String title, String rationale) {
    return new ActionPlan(ActionType.REDEPLOY, title, rationale, null, commitSha, null);
  }

  public static ActionPlan scaleOut(
      int replicas, String commitSha, String title, String rationale) {
    return new ActionPlan(
        ActionType.SCALE_OUT, title, rationale, null, commitSha, SettingsPatch.replicas(replicas));
  }

  public static ActionPlan updateSettings(
      SettingsPatch patch, String commitSha, String title, String rationale) {
    return new ActionPlan(ActionType.UPDATE_SETTINGS, title, rationale, null, commitSha, patch);
  }
}
