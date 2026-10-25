package com.forge.agent.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SecretRedactorTest {

  @Test
  void hidesSecretValuesLongestFirst() {
    var redactor = new SecretRedactor(List.of("hunter2", "hunter2-extended", "ab"));

    assertThat(redactor.redact("password=hunter2-extended and hunter2"))
        .isEqualTo("password=[REDACTED] and [REDACTED]");
  }

  @Test
  void ignoresTinyValuesThatWouldMangleLogs() {
    var redactor = new SecretRedactor(List.of("1", "on"));
    assertThat(redactor.redact("port 1 is on")).isEqualTo("port 1 is on");
  }
}
