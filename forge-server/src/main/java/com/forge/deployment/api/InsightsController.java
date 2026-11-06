package com.forge.deployment.api;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.forge.deployment.DeploymentView;
import com.forge.deployment.application.DeploymentInsightsService;
import com.forge.deployment.application.DeploymentInsightsService.Instance;
import com.forge.deployment.application.DeploymentInsightsService.Overview;
import com.forge.deployment.application.DeploymentInsightsService.Traffic;
import com.forge.shared.security.AuthenticatedUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only numbers for the dashboard: traffic, instances, activity feed and overview. */
@RestController
@Validated
@RequestMapping("/api/v1")
class InsightsController {

  private final DeploymentInsightsService insights;

  InsightsController(DeploymentInsightsService insights) {
    this.insights = insights;
  }

  @GetMapping("/deployments/{id}/traffic")
  Traffic traffic(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return insights.traffic(id, user.id());
  }

  @GetMapping("/projects/{id}/instances")
  List<Instance> instances(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return insights.instances(id, user.id());
  }

  @GetMapping("/activity")
  List<ActivityItem> activity(
      @AuthenticationPrincipal AuthenticatedUser user,
      @RequestParam(defaultValue = "20") int limit) {
    int clamped = Math.clamp(limit, 1, 100); // out-of-range values are clamped, not rejected
    return insights.activity(user.id(), clamped).stream()
        .map(a -> new ActivityItem(a.deployment(), a.projectName(), a.projectSlug()))
        .toList();
  }

  @GetMapping("/overview")
  Overview overview(@AuthenticationPrincipal AuthenticatedUser user) {
    return insights.overview(user.id());
  }

  /** A deployment view (its own {@code projectId} included) plus the project's name and slug. */
  record ActivityItem(
      @JsonUnwrapped DeploymentView deployment, String projectName, String projectSlug) {}
}
