package com.forge.agent.api;

import com.forge.agent.application.InsightService;
import com.forge.agent.domain.Insight;
import com.forge.shared.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** The agent's diagnosis of a failed deployment (404 until the agent has finished). */
@RestController
class InsightController {

  private final InsightService insights;

  InsightController(InsightService insights) {
    this.insights = insights;
  }

  @GetMapping("/api/v1/deployments/{id}/insight")
  InsightResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    Insight insight = insights.getOwned(id, user.id());
    return new InsightResponse(
        insight.deploymentId(),
        insight.category(),
        insight.summary(),
        insight.suggestedFix(),
        insight.confidence().name(),
        insight.engine(),
        insight.evidence() == null || insight.evidence().isBlank()
            ? List.of()
            : List.of(insight.evidence().split("\n")),
        insight.createdAt());
  }

  record InsightResponse(
      UUID deploymentId,
      String category,
      String summary,
      String suggestedFix,
      String confidence,
      String engine,
      List<String> evidence,
      Instant createdAt) {}
}
