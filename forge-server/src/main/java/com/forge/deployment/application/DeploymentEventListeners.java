package com.forge.deployment.application;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentStatusChanged;
import com.forge.deployment.domain.DeploymentEvent;
import com.forge.deployment.infrastructure.DeploymentEventRepository;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.logs.LogStreams;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Observers of {@link DeploymentStatusChanged} inside the deployment module.
 *
 * <ul>
 *   <li>Audit: in the same transaction, so the timeline can never disagree with the status.
 *   <li>Live viewers and metrics: only after commit, so nobody is told about a change that was
 *       rolled back.
 * </ul>
 */
@Component
class DeploymentEventListeners {

  private final DeploymentEventRepository auditLog;
  private final LogSink logs;
  private final LogStreams streams;
  private final MeterRegistry meters;

  DeploymentEventListeners(
      DeploymentEventRepository auditLog, LogSink logs, LogStreams streams, MeterRegistry meters) {
    this.auditLog = auditLog;
    this.logs = logs;
    this.streams = streams;
    this.meters = meters;
  }

  @EventListener
  void audit(DeploymentStatusChanged event) {
    auditLog.save(
        new DeploymentEvent(
            event.deploymentId(), event.from(), event.to(), event.message(), event.occurredAt()));
  }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  void broadcast(DeploymentStatusChanged event) {
    logs.append(
        event.deploymentId(), LogSource.SYSTEM, "● " + event.to() + " — " + event.message());
    boolean streamEnds = event.to().isTerminal() || event.to() == DeploymentStatus.LIVE;
    streams.publishStatus(
        event.deploymentId(),
        event.to().name(),
        event.failureReason() == null ? null : event.failureReason().name(),
        streamEnds);
    if (event.to().isTerminal() || event.to() == DeploymentStatus.LIVE) {
      meters.counter("forge.deployments.finished", "status", event.to().name()).increment();
    }
  }
}
