package com.forge.deployment;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read model of a deployment, shared with the API, notifications and the agent. {@code
 * trafficPercent} is the new version's share of the traffic while it is in CANARY, else null.
 */
public record DeploymentView(
    UUID id,
    UUID projectId,
    String commitSha,
    String commitMessage,
    DeploymentTrigger trigger,
    DeploymentStatus status,
    Integer trafficPercent,
    FailureReason failureReason,
    String failureDetail,
    String imageRef,
    UUID rollbackOfId,
    Instant createdAt,
    Instant startedAt,
    Instant finishedAt,
    List<TimelineEntry> timeline) {

  /** One audited status change. */
  public record TimelineEntry(
      DeploymentStatus from, DeploymentStatus to, String message, Instant at) {}
}
