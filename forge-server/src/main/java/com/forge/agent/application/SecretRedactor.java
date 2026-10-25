package com.forge.agent.application;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * Guardrail: removes the project's secret values from log lines before the agent (and possibly an
 * external LLM) sees them. Longer secrets are replaced first so overlapping values stay hidden.
 */
final class SecretRedactor {

  private static final int MIN_SECRET_LENGTH = 4;
  static final String MASK = "[REDACTED]";

  private final List<String> secrets;

  SecretRedactor(Collection<String> secretValues) {
    this.secrets =
        secretValues.stream()
            .filter(v -> v != null && v.length() >= MIN_SECRET_LENGTH)
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();
  }

  String redact(String line) {
    String result = line;
    for (String secret : secrets) {
      result = result.replace(secret, MASK);
    }
    return result;
  }
}
