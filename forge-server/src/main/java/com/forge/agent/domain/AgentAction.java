package com.forge.agent.domain;

import com.forge.build.BuildType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/**
 * An action the agent proposed for a project. It has no setters: it is created PROPOSED and then
 * moves only along {@link ActionStatus}'s transitions: {@link #approve}, then {@link #executed} or
 * {@link #failed}; or {@link #rejected} / {@link #expired}. The agent never executes it; an
 * approval by the owner does.
 */
@Entity
@Table(name = "agent_actions")
public class AgentAction {

  @Id private UUID id;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @Column(name = "deployment_id")
  private UUID deploymentId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ActionType type;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ActionStatus status;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ActionSource source;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false)
  private String rationale;

  @Column(name = "target_deployment_id")
  private UUID targetDeploymentId;

  @Column(name = "commit_sha")
  private String commitSha;

  @Column(name = "root_dir")
  private String rootDir;

  @Enumerated(EnumType.STRING)
  @Column(name = "build_type")
  private BuildType buildType;

  @Column private Integer port;

  @Column(name = "health_check_path")
  private String healthCheckPath;

  @Column private Integer replicas;

  @Column(name = "result_deployment_id")
  private UUID resultDeploymentId;

  @Column(name = "result_message")
  private String resultMessage;

  @Column(name = "decided_by")
  private UUID decidedBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "decided_at")
  private Instant decidedAt;

  @Version private long version;

  protected AgentAction() {
    // for JPA
  }

  private AgentAction(
      UUID projectId, UUID deploymentId, ActionSource source, ActionPlan plan, Instant now) {
    this.id = UUID.randomUUID();
    this.projectId = projectId;
    this.deploymentId = deploymentId;
    this.source = source;
    this.type = plan.type();
    this.status = ActionStatus.PROPOSED;
    this.title = plan.title();
    this.rationale = plan.rationale();
    this.targetDeploymentId = plan.targetDeploymentId();
    this.commitSha = plan.commitSha();
    if (plan.settings() != null) {
      this.rootDir = plan.settings().rootDir();
      this.buildType = plan.settings().buildType();
      this.port = plan.settings().port();
      this.healthCheckPath = plan.settings().healthCheckPath();
      this.replicas = plan.settings().replicas();
    }
    this.createdAt = now;
  }

  /** Factory method: the only way to create an action, always in PROPOSED. */
  public static AgentAction propose(
      UUID projectId, UUID deploymentId, ActionSource source, ActionPlan plan, Instant now) {
    return new AgentAction(projectId, deploymentId, source, plan, now);
  }

  public void approve(UUID userId, Instant now) {
    decide(ActionStatus.APPROVED, userId, null, now);
  }

  public void executed(UUID resultDeploymentId, String message, Instant now) {
    decide(ActionStatus.EXECUTED, decidedBy, message, now);
    this.resultDeploymentId = resultDeploymentId;
  }

  public void failed(String message, Instant now) {
    decide(ActionStatus.FAILED, decidedBy, message, now);
  }

  public void rejected(UUID userId, Instant now) {
    decide(ActionStatus.REJECTED, userId, "Rejected by the owner", now);
  }

  public void expired(String why, Instant now) {
    decide(ActionStatus.EXPIRED, null, why, now);
  }

  private void decide(ActionStatus next, UUID userId, String message, Instant now) {
    if (!status.canMoveTo(next)) {
      throw new IllegalStateException(
          "Action " + id + " is " + status + " and cannot become " + next);
    }
    this.status = next;
    this.decidedBy = userId;
    this.resultMessage = message;
    this.decidedAt = now;
  }

  public SettingsPatch settings() {
    SettingsPatch patch = new SettingsPatch(rootDir, buildType, port, healthCheckPath, replicas);
    return patch.isEmpty() ? null : patch;
  }

  public UUID id() {
    return id;
  }

  public UUID projectId() {
    return projectId;
  }

  public UUID deploymentId() {
    return deploymentId;
  }

  public ActionType type() {
    return type;
  }

  public ActionStatus status() {
    return status;
  }

  public ActionSource source() {
    return source;
  }

  public String title() {
    return title;
  }

  public String rationale() {
    return rationale;
  }

  public UUID targetDeploymentId() {
    return targetDeploymentId;
  }

  public String commitSha() {
    return commitSha;
  }

  public UUID resultDeploymentId() {
    return resultDeploymentId;
  }

  public String resultMessage() {
    return resultMessage;
  }

  public UUID decidedBy() {
    return decidedBy;
  }

  public Instant createdAt() {
    return createdAt;
  }

  public Instant decidedAt() {
    return decidedAt;
  }
}
