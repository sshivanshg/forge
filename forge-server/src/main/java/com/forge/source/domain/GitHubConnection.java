package com.forge.source.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A user's linked GitHub account. The OAuth token is stored encrypted (AES-GCM). */
@Entity
@Table(name = "github_connections")
public class GitHubConnection {

  @Id private UUID id;

  @Column(name = "user_id", nullable = false, unique = true)
  private UUID userId;

  @Column(name = "github_user_id", nullable = false)
  private long githubUserId;

  @Column(name = "github_login", nullable = false)
  private String githubLogin;

  @Column(name = "access_token_enc", nullable = false)
  private byte[] encryptedAccessToken;

  @Column(nullable = false)
  private String scopes;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected GitHubConnection() {
    // for JPA
  }

  public GitHubConnection(
      UUID userId,
      long githubUserId,
      String githubLogin,
      byte[] encryptedAccessToken,
      String scopes,
      Instant now) {
    this.id = UUID.randomUUID();
    this.userId = userId;
    this.createdAt = now;
    relink(githubUserId, githubLogin, encryptedAccessToken, scopes);
  }

  /** Reconnecting replaces the account and token instead of creating a second row. */
  public void relink(
      long githubUserId, String githubLogin, byte[] encryptedAccessToken, String scopes) {
    this.githubUserId = githubUserId;
    this.githubLogin = githubLogin;
    this.encryptedAccessToken = encryptedAccessToken;
    this.scopes = scopes == null ? "" : scopes;
  }

  public String githubLogin() {
    return githubLogin;
  }

  public byte[] encryptedAccessToken() {
    return encryptedAccessToken;
  }
}
