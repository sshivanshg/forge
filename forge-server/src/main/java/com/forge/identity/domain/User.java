package com.forge.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** A Forge account. Only the BCrypt hash of the password is ever stored. */
@Entity
@Table(name = "users")
public class User {

  @Id private UUID id;

  @Column(nullable = false)
  private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "display_name", nullable = false)
  private String displayName;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected User() {
    // for JPA
  }

  private User(UUID id, String email, String passwordHash, String displayName, Instant now) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.displayName = displayName;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** Factory method: the only way to create a user, so emails are always normalised. */
  public static User register(String email, String passwordHash, String displayName, Instant now) {
    Objects.requireNonNull(passwordHash, "passwordHash");
    return new User(
        UUID.randomUUID(), normaliseEmail(email), passwordHash, displayName.strip(), now);
  }

  public static String normaliseEmail(String email) {
    return email.strip().toLowerCase();
  }

  public UUID id() {
    return id;
  }

  public String email() {
    return email;
  }

  public String passwordHash() {
    return passwordHash;
  }

  public String displayName() {
    return displayName;
  }

  public Instant createdAt() {
    return createdAt;
  }
}
