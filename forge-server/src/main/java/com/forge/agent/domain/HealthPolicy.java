package com.forge.agent.domain;

import java.util.Optional;

/**
 * Decides whether a LIVE app is degrading, and what the agent should recommend. Pure function, so
 * the decision is unit-testable without traffic, a proxy or a clock. The watcher only turns the
 * verdict into a proposal; the owner still decides.
 */
public final class HealthPolicy {

  /** What the agent recommends for a degrading app. */
  public enum Verdict {
    /** The version itself looks broken (errors): go back to the previous good image. */
    ROLLBACK,
    /** The version works but is overloaded (slow under load): add a replica. */
    SCALE_OUT
  }

  private HealthPolicy() {}

  /**
   * @return empty while the app looks healthy (or there is too little traffic to judge)
   */
  public static Optional<Verdict> assess(HealthWindow window) {
    // TODO(human): decide when a live app is degrading and which fix to recommend.
    return Optional.empty();
  }
}
