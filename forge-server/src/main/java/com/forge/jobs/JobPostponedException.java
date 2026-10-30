package com.forge.jobs;

import java.time.Duration;

/**
 * Thrown by a handler that cannot run yet (for example another deployment of the same project is
 * still in progress). The job goes back to the queue after {@code delay} without using up an
 * attempt.
 */
public class JobPostponedException extends RuntimeException {

  private final Duration delay;

  public JobPostponedException(String reason, Duration delay) {
    super(reason);
    this.delay = delay;
  }

  public Duration delay() {
    return delay;
  }
}
