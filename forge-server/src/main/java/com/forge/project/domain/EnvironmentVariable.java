package com.forge.project.domain;

import com.forge.shared.error.ValidationException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * A secret configuration value for a project. The value is stored only as AES-GCM ciphertext; the
 * entity never sees the plaintext.
 */
@Entity
@Table(name = "environment_variables")
public class EnvironmentVariable {

  private static final Pattern KEY = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]{0,254}$");

  @Id private UUID id;

  @Column(name = "project_id", nullable = false)
  private UUID projectId;

  @Column(name = "key", nullable = false)
  private String key;

  @Column(name = "value_enc", nullable = false)
  private byte[] encryptedValue;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected EnvironmentVariable() {
    // for JPA
  }

  public EnvironmentVariable(UUID projectId, String key, byte[] encryptedValue, Instant now) {
    validateKey(key);
    this.id = UUID.randomUUID();
    this.projectId = projectId;
    this.key = key;
    this.encryptedValue = encryptedValue;
    this.createdAt = now;
    this.updatedAt = now;
  }

  public static void validateKey(String key) {
    if (key == null || !KEY.matcher(key).matches()) {
      throw new ValidationException("env var key '" + key + "' must match [A-Za-z_][A-Za-z0-9_]*");
    }
  }

  public void replaceValue(byte[] newEncryptedValue, Instant now) {
    this.encryptedValue = newEncryptedValue;
    this.updatedAt = now;
  }

  public String key() {
    return key;
  }

  public byte[] encryptedValue() {
    return encryptedValue;
  }

  public Instant updatedAt() {
    return updatedAt;
  }
}
