package com.forge.identity.infrastructure;

import com.forge.identity.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

  Optional<User> findByEmail(String normalisedEmail);

  boolean existsByEmail(String normalisedEmail);
}
