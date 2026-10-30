package com.forge.identity;

import java.util.Optional;
import java.util.UUID;

/** Public API of the identity module: read-only access to users for other modules. */
public interface UserLookup {

  Optional<UserSummary> findById(UUID userId);

  /** Lightweight, immutable view of a user that is safe to share across modules. */
  record UserSummary(UUID id, String email, String displayName) {}
}
