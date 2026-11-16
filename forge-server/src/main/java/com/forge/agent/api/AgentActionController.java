package com.forge.agent.api;

import com.forge.agent.application.AgentActionService;
import com.forge.agent.domain.AgentAction;
import com.forge.agent.domain.SettingsPatch;
import com.forge.shared.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** The agent's proposals and the owner's approve / reject decisions. */
@RestController
class AgentActionController {

  private final AgentActionService actions;

  AgentActionController(AgentActionService actions) {
    this.actions = actions;
  }

  @GetMapping("/api/v1/projects/{projectId}/agent/actions")
  List<ActionResponse> forProject(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID projectId) {
    return actions.listForProject(projectId, user.id()).stream().map(ActionResponse::of).toList();
  }

  @GetMapping("/api/v1/deployments/{deploymentId}/agent/actions")
  List<ActionResponse> forDeployment(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID deploymentId) {
    return actions.listForDeployment(deploymentId, user.id()).stream()
        .map(ActionResponse::of)
        .toList();
  }

  @PostMapping("/api/v1/agent/actions/{id}/approve")
  ActionResponse approve(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ActionResponse.of(actions.approve(id, user.id()));
  }

  @PostMapping("/api/v1/agent/actions/{id}/reject")
  ActionResponse reject(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ActionResponse.of(actions.reject(id, user.id()));
  }

  record ActionResponse(
      UUID id,
      UUID projectId,
      UUID deploymentId,
      String type,
      String status,
      String source,
      String title,
      String rationale,
      UUID targetDeploymentId,
      String commitSha,
      SettingsPatch settings,
      UUID resultDeploymentId,
      String resultMessage,
      Instant createdAt,
      Instant decidedAt) {

    static ActionResponse of(AgentAction a) {
      return new ActionResponse(
          a.id(),
          a.projectId(),
          a.deploymentId(),
          a.type().name(),
          a.status().name(),
          a.source().name(),
          a.title(),
          a.rationale(),
          a.targetDeploymentId(),
          a.commitSha(),
          a.settings(),
          a.resultDeploymentId(),
          a.resultMessage(),
          a.createdAt(),
          a.decidedAt());
    }
  }
}
