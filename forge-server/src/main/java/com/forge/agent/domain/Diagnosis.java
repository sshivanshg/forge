package com.forge.agent.domain;

import java.util.List;

/**
 * The agent's conclusion: what went wrong, how to fix it, how sure it is, and the log lines that
 * support it (so the user can verify instead of blindly trusting it).
 */
public record Diagnosis(
    String category,
    String summary,
    String suggestedFix,
    Confidence confidence,
    List<String> evidence) {

  public Diagnosis {
    evidence =
        evidence == null
            ? List.of()
            : List.copyOf(evidence.subList(0, Math.min(evidence.size(), 8)));
  }

  /** How strongly the evidence supports the diagnosis. */
  public enum Confidence {
    LOW,
    MEDIUM,
    HIGH
  }
}
