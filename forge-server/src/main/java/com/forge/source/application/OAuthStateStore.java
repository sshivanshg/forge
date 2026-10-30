package com.forge.source.application;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Single-use, short-lived OAuth {@code state} values. The state ties GitHub's callback to the user
 * who started the flow and protects against CSRF (an attacker cannot make a victim's browser link
 * the attacker's GitHub account).
 *
 * <p>In-memory is fine for a single instance; with several API replicas it moves to Redis.
 */
@Component
class OAuthStateStore {

  private static final Duration TTL = Duration.ofMinutes(10);

  private final Map<String, Entry> states = new ConcurrentHashMap<>();
  private final SecureRandom random = new SecureRandom();
  private final Clock clock;

  OAuthStateStore(Clock clock) {
    this.clock = clock;
  }

  String issue(UUID userId) {
    purgeExpired();
    byte[] bytes = new byte[24];
    random.nextBytes(bytes);
    String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    states.put(state, new Entry(userId, clock.instant().plus(TTL)));
    return state;
  }

  /** Returns the user and removes the state: a state can be used exactly once. */
  Optional<UUID> consume(String state) {
    if (state == null) {
      return Optional.empty();
    }
    Entry entry = states.remove(state);
    if (entry == null || entry.expiresAt().isBefore(clock.instant())) {
      return Optional.empty();
    }
    return Optional.of(entry.userId());
  }

  private void purgeExpired() {
    Instant now = clock.instant();
    states.values().removeIf(e -> e.expiresAt().isBefore(now));
  }

  private record Entry(UUID userId, Instant expiresAt) {}
}
