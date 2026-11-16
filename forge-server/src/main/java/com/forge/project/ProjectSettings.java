package com.forge.project;

import java.util.UUID;

/**
 * Public write API of the project module for other modules (the agent). It applies the same
 * validation as the settings page, because it goes through the same domain methods.
 */
public interface ProjectSettings {

  /**
   * @throws com.forge.shared.error.NotFoundException if missing or not owned by {@code ownerId}
   */
  ProjectSnapshot apply(UUID projectId, UUID ownerId, SettingsChange change);
}
