package com.forge.jobs.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class BackoffTest {

  @Test
  void doublesEachAttemptUpToFiveMinutes() {
    assertThat(PostgresJobQueue.backoff(1)).isEqualTo(Duration.ofSeconds(10));
    assertThat(PostgresJobQueue.backoff(2)).isEqualTo(Duration.ofSeconds(20));
    assertThat(PostgresJobQueue.backoff(3)).isEqualTo(Duration.ofSeconds(40));
    assertThat(PostgresJobQueue.backoff(10)).isEqualTo(Duration.ofMinutes(5));
    assertThat(PostgresJobQueue.backoff(100)).isEqualTo(Duration.ofMinutes(5));
  }
}
