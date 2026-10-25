package com.forge.identity.application;

import com.forge.identity.UserLookup;
import com.forge.identity.infrastructure.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class UserLookupService implements UserLookup {

  private final UserRepository users;

  UserLookupService(UserRepository users) {
    this.users = users;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UserSummary> findById(UUID userId) {
    return users.findById(userId).map(u -> new UserSummary(u.id(), u.email(), u.displayName()));
  }
}
