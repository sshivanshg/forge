package com.forge.deployment.domain;

import com.forge.deployment.DeploymentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Append-only audit row: one per status change. Never updated or deleted on its own. */
@Entity
@Table(name = "deployment_events")
public class DeploymentEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "deployment_id", nullable = false)
  private UUID deploymentId;

  @Enumerated(EnumType.STRING)
  @Column(name = "from_status")
  private DeploymentStatus fromStatus;

  @Enumerated(EnumType.STRING)
  @Column(name = "to_status", nullable = false)
  private DeploymentStatus toStatus;

  @Column private String message;

  @Column(name = "occurred_at", nullable = false)
  private Instant occurredAt;

  protected DeploymentEvent() {
    // for JPA
  }

  public DeploymentEvent(
      UUID deploymentId,
      DeploymentStatus fromStatus,
      DeploymentStatus toStatus,
      String message,
      Instant occurredAt) {
    this.deploymentId = deploymentId;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.message = message;
    this.occurredAt = occurredAt;
  }

  public DeploymentStatus fromStatus() {
    return fromStatus;
  }

  public DeploymentStatus toStatus() {
    return toStatus;
  }

  public String message() {
    return message;
  }

  public Instant occurredAt() {
    return occurredAt;
  }
}
