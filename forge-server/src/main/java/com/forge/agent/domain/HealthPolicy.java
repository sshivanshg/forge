package com.forge.agent.domain;

import java.util.Optional;

/**
 * Decides whether a LIVE app is degrading, and what the agent should recommend. Pure function, so
 * the decision is unit-testable without traffic, a proxy or a clock. The watcher only turns the
 * verdict into a proposal; the owner still decides.
 */
public final class HealthPolicy {

  /** Below this many requests in an interval, one error would look like a huge error rate. */
  static final long MIN_REQUESTS = 20;

  /** Share of 5xx answers (absolute, 0 to 1) above which the version itself looks broken. */
  static final double MAX_ERROR_RATE = 0.05;

  /** Slow means at least this many times the learned baseline latency... */
  static final double LATENCY_FACTOR = 3.0;

  /** ...and at least this much slower in absolute terms, so a 2 ms → 6 ms blip is not "slow". */
  static final double MIN_LATENCY_INCREASE_MS = 200;

  /** The most replicas a project may run (same limit as the project's run settings). */
  static final int MAX_REPLICAS = 3;

  /** What the agent recommends for a degrading app. */
  public enum Verdict {
    /** The version itself looks broken (errors): go back to the previous good image. */
    ROLLBACK,
    /** The version works but is overloaded (slow under load): add a replica. */
    SCALE_OUT
  }

  private HealthPolicy() {}

  /**
   * Errors are checked first: a crashing app is often slow too, and more replicas of a broken
   * version do not help.
   *
   * @return empty while the app looks healthy (or there is too little traffic to judge)
   */
  public static Optional<Verdict> assess(HealthWindow window) {
    if (window.requests() < MIN_REQUESTS) {
      return Optional.empty();
    }
    if (window.errorRate() > MAX_ERROR_RATE) {
      return Optional.of(Verdict.ROLLBACK);
    }
    double baseline = window.baselineLatencyMillis();
    boolean slow =
        baseline > 0
            && window.meanLatencyMillis() >= baseline * LATENCY_FACTOR
            && window.meanLatencyMillis() - baseline >= MIN_LATENCY_INCREASE_MS;
    if (slow && window.replicas() < MAX_REPLICAS) {
      return Optional.of(Verdict.SCALE_OUT);
    }
    return Optional.empty();
  }
}
