package com.forge.deployment;

import java.time.Instant;
import java.util.UUID;

/**
 * Domain event raised by the {@code Deployment} aggregate on every transition. Observers (audit
 * log, live log streams, notifications, the AI agent) react to it without the deployment module
 * knowing they exist.
 *
 * @param from previous status, {@code null} when the deployment was just created
 */
public record DeploymentStatusChanged(
    UUID deploymentId,
    UUID projectId,
    DeploymentStatus from,
    DeploymentStatus to,
    FailureReason failureReason,
    String message,
    Instant occurredAt) {}
