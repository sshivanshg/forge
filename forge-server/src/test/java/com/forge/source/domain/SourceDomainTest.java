package com.forge.source.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SourceDomainTest {

  private static final Instant NOW = Instant.parse("2026-10-26T10:00:00Z");

  @Test
  void connectionKeepsTheEncryptedTokenAndLogin() {
    byte[] token = {1, 2, 3};

    GitHubConnection connection =
        new GitHubConnection(UUID.randomUUID(), 42L, "octocat", token, "repo", NOW);

    assertThat(connection.githubLogin()).isEqualTo("octocat");
    assertThat(connection.encryptedAccessToken()).containsExactly(1, 2, 3);
  }

  @Test
  void relinkingReplacesTheAccountInsteadOfAddingOne() {
    GitHubConnection connection =
        new GitHubConnection(UUID.randomUUID(), 42L, "octocat", new byte[] {1}, "repo", NOW);

    connection.relink(7L, "hubot", new byte[] {9, 9}, null);

    assertThat(connection.githubLogin()).isEqualTo("hubot");
    assertThat(connection.encryptedAccessToken()).containsExactly(9, 9);
  }

  @Test
  void deliveryRecordsTheIdItWasReceivedWith() {
    assertThatCode(() -> new WebhookDelivery("delivery-1", "push", NOW)).doesNotThrowAnyException();
  }
}
