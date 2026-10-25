package com.forge.project.application;

import com.forge.project.domain.EnvironmentVariable;
import com.forge.project.infrastructure.EnvironmentVariableRepository;
import com.forge.shared.crypto.EncryptionService;
import com.forge.shared.error.NotFoundException;
import com.forge.shared.error.ValidationException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages a project's environment variables. Values are encrypted before they reach the entity and
 * are only ever shown masked through the API.
 */
@Service
public class EnvironmentService {

  static final int MAX_VALUE_LENGTH = 32_768;
  static final int MAX_VARIABLES = 100;

  private final EnvironmentVariableRepository variables;
  private final ProjectService projects;
  private final EncryptionService encryption;
  private final Clock clock;

  public EnvironmentService(
      EnvironmentVariableRepository variables,
      ProjectService projects,
      EncryptionService encryption,
      Clock clock) {
    this.variables = variables;
    this.projects = projects;
    this.encryption = encryption;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public List<MaskedVariable> list(UUID ownerId, UUID projectId) {
    projects.get(ownerId, projectId);
    return variables.findByProject(projectId).stream()
        .map(
            v ->
                new MaskedVariable(
                    v.key(), mask(encryption.decrypt(v.encryptedValue())), v.updatedAt()))
        .toList();
  }

  /** Inserts new keys and replaces existing ones. Keys not mentioned are left untouched. */
  @Transactional
  public void upsert(UUID ownerId, UUID projectId, Map<String, String> values) {
    projects.get(ownerId, projectId);
    if (variables.findByProject(projectId).size() + values.size() > MAX_VARIABLES) {
      throw new ValidationException("A project can have at most " + MAX_VARIABLES + " variables");
    }
    Instant now = clock.instant();
    values.forEach(
        (key, value) -> {
          EnvironmentVariable.validateKey(key);
          if (value == null || value.length() > MAX_VALUE_LENGTH) {
            throw new ValidationException("Value of " + key + " is missing or too long");
          }
          byte[] encrypted = encryption.encrypt(value);
          variables
              .findByProjectAndKey(projectId, key)
              .ifPresentOrElse(
                  existing -> existing.replaceValue(encrypted, now),
                  () -> variables.save(new EnvironmentVariable(projectId, key, encrypted, now)));
        });
  }

  @Transactional
  public void delete(UUID ownerId, UUID projectId, String key) {
    projects.get(ownerId, projectId);
    EnvironmentVariable variable =
        variables
            .findByProjectAndKey(projectId, key)
            .orElseThrow(() -> new NotFoundException("Environment variable", key));
    variables.delete(variable);
  }

  /** Decrypted values; package-private, only the catalog hands them to the deployment pipeline. */
  @Transactional(readOnly = true)
  Map<String, String> decrypted(UUID projectId) {
    var result = new java.util.LinkedHashMap<String, String>();
    variables
        .findByProject(projectId)
        .forEach(v -> result.put(v.key(), encryption.decrypt(v.encryptedValue())));
    return result;
  }

  /** "postgres://..." → "po••••••". Short values are fully masked. */
  static String mask(String value) {
    return value.length() < 8 ? "••••••" : value.substring(0, 2) + "••••••";
  }

  public record MaskedVariable(String key, String valuePreview, Instant updatedAt) {}
}
