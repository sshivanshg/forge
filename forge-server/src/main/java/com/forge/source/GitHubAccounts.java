package com.forge.source;

import java.util.Optional;
import java.util.UUID;

/** Public API: the decrypted GitHub token of a user, if they connected GitHub. */
public interface GitHubAccounts {

  Optional<String> accessTokenFor(UUID userId);
}
