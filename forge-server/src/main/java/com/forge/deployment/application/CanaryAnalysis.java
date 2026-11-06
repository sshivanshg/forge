package com.forge.deployment.application;

import com.forge.runtime.TrafficSample;
import java.util.Locale;

/**
 * Decides, from one canary step's traffic, whether the new version is doing worse than the live
 * one. Pure logic (no I/O), so every rule is unit-tested.
 *
 * <p>The new version is compared with the live version over the <em>same</em> period, not with a
 * fixed threshold: if the live version also returns errors (a database outage, say), the new
 * version is not blamed for it.
 */
final class CanaryAnalysis {

  enum Outcome {
    /** As good as the live version: continue. */
    HEALTHY,
    /** Clearly worse than the live version: roll back. */
    REGRESSION,
    /** Too few requests reached the new version to tell. */
    INCONCLUSIVE
  }

  record Verdict(Outcome outcome, String summary) {
    boolean regression() {
      return outcome == Outcome.REGRESSION;
    }
  }

  private final DeploymentProperties.Canary rules;

  CanaryAnalysis(DeploymentProperties.Canary rules) {
    this.rules = rules;
  }

  /**
   * @param canary what the new version saw during the step
   * @param live what the live version saw during the same step
   */
  Verdict judge(TrafficSample canary, TrafficSample live) {
    if (canary.requests() < rules.minRequests()) {
      return new Verdict(
          Outcome.INCONCLUSIVE,
          "only "
              + canary.requests()
              + " request(s) reached the new version, too few to compare (need "
              + rules.minRequests()
              + ")");
    }
    String figures =
        "new version: "
            + describe(canary)
            + "; live version: "
            + (live.requests() == 0 ? "no requests" : describe(live));
    double errorIncrease = canary.errorRate() - live.errorRate();
    if (errorIncrease > rules.maxErrorRateIncrease()) {
      return new Verdict(
          Outcome.REGRESSION,
          "error rate is " + percent(errorIncrease) + " higher (" + figures + ")");
    }
    if (live.requests() > 0 && slower(canary.meanLatencyMillis(), live.meanLatencyMillis())) {
      return new Verdict(Outcome.REGRESSION, "responses are much slower (" + figures + ")");
    }
    return new Verdict(Outcome.HEALTHY, figures);
  }

  private boolean slower(double canaryMs, double liveMs) {
    return canaryMs > liveMs * rules.maxLatencyFactor()
        && canaryMs - liveMs > rules.minLatencyIncrease().toMillis();
  }

  private static String describe(TrafficSample s) {
    return String.format(
        Locale.ROOT,
        "%d requests, %s errors, %.0f ms avg",
        s.requests(),
        percent(s.errorRate()),
        s.meanLatencyMillis());
  }

  private static String percent(double fraction) {
    return String.format(Locale.ROOT, "%.1f%%", fraction * 100);
  }
}
