package com.forge.agent.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** The stored result of the agent's investigation of one failed deployment. */
@Entity
@Table(name = "deployment_insights")
public class Insight {

  @Id
  @Column(name = "deployment_id")
  private UUID deploymentId;

  @Column(nullable = false)
  private String category;

  @Column(nullable = false)
  private String summary;

  @Column(name = "suggested_fix", nullable = false)
  private String suggestedFix;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Diagnosis.Confidence confidence;

  @Column(nullable = false)
  private String engine;

  @Column private String evidence;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected Insight() {
    // for JPA
  }

  public Insight(UUID deploymentId, Diagnosis diagnosis, String engine, Instant now) {
    this.deploymentId = deploymentId;
    this.category = diagnosis.category();
    this.summary = diagnosis.summary();
    this.suggestedFix = diagnosis.suggestedFix();
    this.confidence = diagnosis.confidence();
    this.engine = engine;
    this.evidence = String.join("\n", diagnosis.evidence());
    this.createdAt = now;
  }

  public UUID deploymentId() {
    return deploymentId;
  }

  public String category() {
    return category;
  }

  public String summary() {
    return summary;
  }

  public String suggestedFix() {
    return suggestedFix;
  }

  public Diagnosis.Confidence confidence() {
    return confidence;
  }

  public String engine() {
    return engine;
  }

  public String evidence() {
    return evidence;
  }

  public Instant createdAt() {
    return createdAt;
  }
}
