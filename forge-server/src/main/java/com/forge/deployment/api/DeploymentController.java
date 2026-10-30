package com.forge.deployment.api;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentView;
import com.forge.deployment.application.DeploymentQueryService;
import com.forge.deployment.application.DeploymentService;
import com.forge.deployment.application.RuntimeLogStreamer;
import com.forge.logs.LogLine;
import com.forge.logs.LogReader;
import com.forge.logs.LogStreams;
import com.forge.shared.security.AuthenticatedUser;
import com.forge.shared.web.PageResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Deployments, their logs and live streams. Starting, cancelling and rolling back answer {@code 202
 * Accepted}: the work happens asynchronously in the job queue.
 */
@RestController
@Validated
@RequestMapping("/api/v1")
class DeploymentController {

  private final DeploymentService deployments;
  private final DeploymentQueryService queries;
  private final LogReader logReader;
  private final LogStreams logStreams;
  private final RuntimeLogStreamer runtimeLogs;

  DeploymentController(
      DeploymentService deployments,
      DeploymentQueryService queries,
      LogReader logReader,
      LogStreams logStreams,
      RuntimeLogStreamer runtimeLogs) {
    this.deployments = deployments;
    this.queries = queries;
    this.logReader = logReader;
    this.logStreams = logStreams;
    this.runtimeLogs = runtimeLogs;
  }

  @PostMapping("/projects/{projectId}/deployments")
  ResponseEntity<DeploymentView> deploy(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID projectId,
      @RequestBody(required = false) DeployRequest request) {
    String sha = request == null ? null : request.commitSha();
    DeploymentView created = deployments.request(projectId, user.id(), sha);
    return accepted(created);
  }

  @GetMapping("/projects/{projectId}/deployments")
  PageResponse<DeploymentView> history(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID projectId,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
    return PageResponse.from(deployments.history(projectId, user.id(), pageable), view -> view);
  }

  @GetMapping("/deployments/{id}")
  DeploymentView get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return queries.getOwned(id, user.id());
  }

  @PostMapping("/deployments/{id}/cancel")
  ResponseEntity<DeploymentView> cancel(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return ResponseEntity.accepted().body(deployments.cancel(id, user.id()));
  }

  @PostMapping("/deployments/{id}/rollback")
  ResponseEntity<DeploymentView> rollback(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
    return accepted(deployments.rollback(id, user.id()));
  }

  @GetMapping("/deployments/{id}/logs")
  List<LogLine> logs(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") @Min(0) int after,
      @RequestParam(defaultValue = "500") @Min(1) @Max(5000) int limit) {
    queries.getOwned(id, user.id());
    return logReader.after(id, after, limit);
  }

  /**
   * Live build and deploy log. Browsers reconnecting automatically send {@code Last-Event-ID}, so
   * the stream resumes exactly after the last line they received.
   */
  @GetMapping(path = "/deployments/{id}/logs/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  SseEmitter stream(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable UUID id,
      @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
    DeploymentView deployment = queries.getOwned(id, user.id());
    int after = parseSeq(lastEventId);
    SseEmitter emitter = logStreams.subscribe(id, after);
    boolean finished =
        deployment.status().isTerminal() || deployment.status() == DeploymentStatus.LIVE;
    if (finished) {
      logStreams.publishStatus(
          id,
          deployment.status().name(),
          deployment.failureReason() == null ? null : deployment.failureReason().name(),
          true);
    }
    return emitter;
  }

  @GetMapping(
      path = "/projects/{projectId}/runtime-logs/stream",
      produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  SseEmitter runtimeLogs(
      @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID projectId) {
    return runtimeLogs.stream(projectId, user.id());
  }

  private static ResponseEntity<DeploymentView> accepted(DeploymentView view) {
    return ResponseEntity.accepted()
        .location(URI.create("/api/v1/deployments/" + view.id()))
        .body(view);
  }

  private static int parseSeq(String lastEventId) {
    if (lastEventId == null) {
      return 0;
    }
    try {
      return Math.max(0, Integer.parseInt(lastEventId.strip()));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  record DeployRequest(String commitSha) {}
}
