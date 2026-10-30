package com.forge.deployment.domain;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentStatusChanged;
import com.forge.deployment.DeploymentTrigger;
import com.forge.deployment.FailureReason;
import com.forge.shared.error.ValidationException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.AbstractAggregateRoot;

/**
 * Aggregate root of the deployment module: one attempt to put one commit of a project live.
 *
 * <p>Encapsulation: there are no setters. The status only changes through intent-revealing methods
 * ({@link #startBuild}, {@link #goLive} …) which all funnel into {@link #transitionTo}, where the
 * state machine is enforced and a {@link DeploymentStatusChanged} event is registered. Spring Data
 * publishes those events when the aggregate is saved.
 *
 * <p>Concurrency: {@link Version} gives optimistic locking. If two workers load the same deployment
 * and both try to change it, the second save fails instead of silently overwriting.
 */
@Entity
@Table(name = "deployments")
public class Deployment extends AbstractAggregateRoot<Deployment> {

  private static final Pattern SHA = Pattern.compile("^[0-9a-f]{40}$");
  private static final Set<DeploymentStatus> ROLLBACK_TARGETS =
      Set.of(DeploymentStatus.LIVE, DeploymentStatus.SUPERSEDED, DeploymentStatus.STOPPED);

  @Id private UUID id;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @JdbcTypeCode(SqlTypes.CHAR) // CHAR(40): a SHA always has exactly 40 characters
  @Column(name = "commit_sha", nullable = false, length = 40)
  private String commitSha;

  @Column(name = "commit_message")
  private String commitMessage;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private DeploymentTrigger trigger;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private DeploymentStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "failure_reason")
  private FailureReason failureReason;

  @Column(name = "failure_detail")
  private String failureDetail;

  @Column(name = "image_ref")
  private String imageRef;

  @Column(name = "rollback_of_id")
  private UUID rollbackOfId;

  @Column(name = "triggered_by")
  private UUID triggeredBy;

  @Version private long version;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "started_at")
  private Instant startedAt;

  @Column(name = "finished_at")
  private Instant finishedAt;

  protected Deployment() {
    // for JPA
  }

  private Deployment(
      UUID projectId,
      String commitSha,
      String commitMessage,
      DeploymentTrigger trigger,
      UUID triggeredBy,
      Instant now) {
    if (commitSha == null || !SHA.matcher(commitSha).matches()) {
      throw new ValidationException("commitSha must be a full 40-character lowercase hex SHA");
    }
    this.id = UUID.randomUUID();
    this.projectId = projectId;
    this.commitSha = commitSha;
    this.commitMessage = truncate(commitMessage, 500);
    this.trigger = trigger;
    this.triggeredBy = triggeredBy;
    this.createdAt = now;
    this.status = DeploymentStatus.QUEUED;
    registerEvent(
        new DeploymentStatusChanged(id, projectId, null, status, null, "Deployment queued", now));
  }

  /** Factory method for a normal deployment of a commit (manual click or git push). */
  public static Deployment request(
      UUID projectId,
      String commitSha,
      String commitMessage,
      DeploymentTrigger trigger,
      UUID triggeredBy,
      Instant now) {
    if (trigger == DeploymentTrigger.ROLLBACK) {
      throw new IllegalArgumentException("Use rollbackTo() for rollbacks");
    }
    return new Deployment(projectId, commitSha, commitMessage, trigger, triggeredBy, now);
  }

  /** Factory method for a rollback: reuses the target's image, so no rebuild is needed. */
  public static Deployment rollbackTo(Deployment target, UUID triggeredBy, Instant now) {
    if (!target.canBeRolledBackTo()) {
      throw new ValidationException(
          "Only deployments that went live and still have an image can be rolled back to");
    }
    Deployment rollback =
        new Deployment(
            target.projectId,
            target.commitSha,
            target.commitMessage,
            DeploymentTrigger.ROLLBACK,
            triggeredBy,
            now);
    rollback.imageRef = target.imageRef;
    rollback.rollbackOfId = target.id;
    return rollback;
  }

  public void startBuild(Instant now) {
    transitionTo(DeploymentStatus.BUILDING, "Build started", now);
    this.startedAt = now;
  }

  public void buildSucceeded(String builtImageRef, String message, Instant now) {
    this.imageRef = builtImageRef;
    if (message != null && !message.isBlank()) {
      this.commitMessage = truncate(message, 500);
    }
    transitionTo(DeploymentStatus.DEPLOYING, "Image built", now);
  }

  /** Rollbacks skip the build: QUEUED → DEPLOYING with the image they were created with. */
  public void startDeployWithExistingImage(Instant now) {
    if (imageRef == null) {
      throw new IllegalStateTransitionException(id, status, DeploymentStatus.DEPLOYING);
    }
    transitionTo(DeploymentStatus.DEPLOYING, "Deploying existing image", now);
    this.startedAt = now;
  }

  public void startHealthCheck(Instant now) {
    transitionTo(DeploymentStatus.HEALTH_CHECKING, "Container started, checking health", now);
  }

  public void goLive(Instant now) {
    transitionTo(DeploymentStatus.LIVE, "Health check passed, traffic switched", now);
    this.finishedAt = now;
  }

  public void fail(FailureReason reason, String detail, Instant now) {
    if (!status.canTransitionTo(DeploymentStatus.FAILED)) {
      throw new IllegalStateTransitionException(id, status, DeploymentStatus.FAILED);
    }
    this.failureReason = reason;
    this.failureDetail = truncate(detail, 4_000);
    transitionTo(DeploymentStatus.FAILED, reason.name(), now);
    this.finishedAt = now;
  }

  public void cancel(String why, Instant now) {
    transitionTo(DeploymentStatus.CANCELLED, why, now);
    this.finishedAt = now;
  }

  /** A newer deployment of the same project went live. */
  public void supersede(UUID byDeployment, Instant now) {
    transitionTo(DeploymentStatus.SUPERSEDED, "Replaced by " + byDeployment, now);
  }

  public void stop(Instant now) {
    transitionTo(DeploymentStatus.STOPPED, "Stopped", now);
  }

  public boolean canBeRolledBackTo() {
    return imageRef != null && ROLLBACK_TARGETS.contains(status);
  }

  public boolean isCancellable() {
    return status.canTransitionTo(DeploymentStatus.CANCELLED);
  }

  /** The one place where status changes. Enforces the state machine. */
  private void transitionTo(DeploymentStatus next, String message, Instant now) {
    if (!status.canTransitionTo(next)) {
      throw new IllegalStateTransitionException(id, status, next);
    }
    DeploymentStatus previous = this.status;
    this.status = next;
    registerEvent(
        new DeploymentStatusChanged(id, projectId, previous, next, failureReason, message, now));
  }

  private static String truncate(String value, int max) {
    if (value == null) {
      return null;
    }
    return value.length() > max ? value.substring(0, max) : value;
  }

  public UUID id() {
    return id;
  }

  public UUID projectId() {
    return projectId;
  }

  public String commitSha() {
    return commitSha;
  }

  public String commitMessage() {
    return commitMessage;
  }

  public DeploymentTrigger trigger() {
    return trigger;
  }

  public DeploymentStatus status() {
    return status;
  }

  public FailureReason failureReason() {
    return failureReason;
  }

  public String failureDetail() {
    return failureDetail;
  }

  public String imageRef() {
    return imageRef;
  }

  public UUID rollbackOfId() {
    return rollbackOfId;
  }

  public UUID triggeredBy() {
    return triggeredBy;
  }

  public Instant createdAt() {
    return createdAt;
  }

  public Instant startedAt() {
    return startedAt;
  }

  public Instant finishedAt() {
    return finishedAt;
  }
}
