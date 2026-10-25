package com.forge.jobs;

import java.util.UUID;

/**
 * A claimed unit of background work (Command pattern: the request is an object that can be queued,
 * retried and logged). {@code payload} is JSON.
 */
public record Job(UUID id, JobType type, String payload, int attempts, int maxAttempts) {

  public boolean hasAttemptsLeft() {
    return attempts < maxAttempts;
  }
}
