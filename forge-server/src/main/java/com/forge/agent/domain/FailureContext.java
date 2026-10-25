package com.forge.agent.domain;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * What the agent observes about a failed deployment: the failure itself, the project's settings and
 * the last log lines (with secrets already redacted). This is the agent's entire "view of the
 * world"; diagnosis engines never query anything else.
 */
public record FailureContext(
    UUID deploymentId,
    String projectName,
    String failureReason,
    String failureDetail,
    String buildType,
    int configuredPort,
    String healthCheckPath,
    String commitSha,
    String commitMessage,
    List<String> logLines) {

  public FailureContext {
    logLines = List.copyOf(logLines);
    failureDetail = failureDetail == null ? "" : failureDetail;
  }

  public boolean failedWith(String reason) {
    return reason.equals(failureReason);
  }

  /** Detail and logs as one lower-case text, for simple pattern checks. */
  public String searchableText() {
    return (failureDetail + "\n" + String.join("\n", logLines)).toLowerCase(Locale.ROOT);
  }

  /** Log lines that contain any of the given fragments (case-insensitive), most recent last. */
  public List<String> linesContaining(String... fragments) {
    return logLines.stream()
        .filter(
            line -> {
              String lower = line.toLowerCase(Locale.ROOT);
              for (String fragment : fragments) {
                if (lower.contains(fragment.toLowerCase(Locale.ROOT))) {
                  return true;
                }
              }
              return false;
            })
        .toList();
  }
}
