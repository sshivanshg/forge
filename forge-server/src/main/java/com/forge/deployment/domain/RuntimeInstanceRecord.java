package com.forge.deployment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Bookkeeping of what the control plane started in the data plane, so a deployment's container can
 * be found again (to stream its logs, to stop it when it is replaced or the project deleted).
 */
@Entity
@Table(name = "runtime_instances")
public class RuntimeInstanceRecord {

  /** Lifecycle of the container itself (not of the deployment). */
  public enum Status {
    STARTING,
    RUNNING,
    STOPPED
  }

  @Id private UUID id;

  @Column(name = "deployment_id", nullable = false, unique = true)
  private UUID deploymentId;

  @Column(nullable = false)
  private String kind;

  @Column(name = "external_id", nullable = false)
  private String externalId;

  @Column(name = "internal_url", nullable = false)
  private String internalUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Status status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "stopped_at")
  private Instant stoppedAt;

  protected RuntimeInstanceRecord() {
    // for JPA
  }

  public RuntimeInstanceRecord(
      UUID deploymentId, String externalId, String internalUrl, Instant now) {
    this.id = UUID.randomUUID();
    this.deploymentId = deploymentId;
    this.kind = "DOCKER";
    this.externalId = externalId;
    this.internalUrl = internalUrl;
    this.status = Status.STARTING;
    this.createdAt = now;
  }

  /** A retried deploy job starts a new container for the same deployment. */
  public void replaceContainer(String newExternalId, String newInternalUrl) {
    this.externalId = newExternalId;
    this.internalUrl = newInternalUrl;
    this.status = Status.STARTING;
    this.stoppedAt = null;
  }

  public void markRunning() {
    this.status = Status.RUNNING;
  }

  public void markStopped(Instant now) {
    this.status = Status.STOPPED;
    this.stoppedAt = now;
  }

  public UUID deploymentId() {
    return deploymentId;
  }

  public String externalId() {
    return externalId;
  }

  public Status status() {
    return status;
  }
}
