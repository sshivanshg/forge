package com.forge.project.api;

import com.forge.project.application.EnvironmentService;
import com.forge.project.application.EnvironmentService.MaskedVariable;
import com.forge.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/env")
class EnvironmentController {

  /** Tells the dashboard to show "Redeploy to apply": running containers keep their old env. */
  static final String REDEPLOY_HEADER = "X-Forge-Redeploy-Required";

  private final EnvironmentService environment;

  EnvironmentController(EnvironmentService environment) {
    this.environment = environment;
  }

  @GetMapping
  List<MaskedVariable> list(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID projectId) {
    return environment.list(user.id(), projectId);
  }

  @PutMapping
  ResponseEntity<Void> upsert(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID projectId,
      @Valid @RequestBody UpsertRequest request) {
    environment.upsert(user.id(), projectId, request.vars());
    return ResponseEntity.noContent().header(REDEPLOY_HEADER, "true").build();
  }

  @DeleteMapping("/{key}")
  ResponseEntity<Void> delete(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID projectId,
      @PathVariable String key) {
    environment.delete(user.id(), projectId, key);
    return ResponseEntity.noContent().header(REDEPLOY_HEADER, "true").build();
  }

  record UpsertRequest(@NotNull @Size(min = 1, max = 100) Map<String, String> vars) {}
}
