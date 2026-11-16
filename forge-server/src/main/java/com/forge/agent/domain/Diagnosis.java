package com.forge.agent.domain;

import java.util.List;

/**
 * The agent's conclusion: what went wrong, how to fix it, how sure it is, and the log lines that
 * support it (so the user can verify instead of blindly trusting it), plus any actions it proposes.
 */
public record Diagnosis(
    String category,
    String summary,
    String suggestedFix,
    Confidence confidence,
    List<String> evidence,
    List<ActionPlan> proposals) {

  /** A diagnosis that recommends no action the agent could take. */
  public Diagnosis(
      String category,
      String summary,
      String suggestedFix,
      Confidence confidence,
      List<String> evidence) {
    this(category, summary, suggestedFix, confidence, evidence, List.of());
  }

  public Diagnosis withProposals(List<ActionPlan> plans) {
    return new Diagnosis(category, summary, suggestedFix, confidence, evidence, plans);
  }

  public Diagnosis {
    proposals = proposals == null ? List.of() : List.copyOf(proposals);
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
