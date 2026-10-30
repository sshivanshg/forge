package com.forge.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A long-lived token used to obtain new access tokens. Stored only as a SHA-256 hash, so a database
 * leak does not leak usable tokens. Each use rotates it: the old one is revoked and a new one
 * issued.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

  @Id private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "token_hash", nullable = false, unique = true)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected RefreshToken() {
    // for JPA
  }

  public RefreshToken(UUID userId, String tokenHash, Instant now, Instant expiresAt) {
    this.id = UUID.randomUUID();
    this.userId = userId;
    this.tokenHash = tokenHash;
    this.createdAt = now;
    this.expiresAt = expiresAt;
  }

  public boolean isActive(Instant now) {
    return revokedAt == null && now.isBefore(expiresAt);
  }

  public boolean isRevoked() {
    return revokedAt != null;
  }

  public void revoke(Instant now) {
    if (revokedAt == null) {
      revokedAt = now;
    }
  }

  public UUID userId() {
    return userId;
  }
}
