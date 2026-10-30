package com.forge.identity.infrastructure;

import com.forge.identity.domain.RefreshToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

  Optional<RefreshToken> findByTokenHash(String tokenHash);

  /** Kills every session of a user: used when a revoked token is replayed (likely theft). */
  @Modifying
  @Query(
      "update RefreshToken t set t.revokedAt = :now where t.userId = :userId and t.revokedAt is"
          + " null")
  int revokeAllForUser(UUID userId, Instant now);
}
