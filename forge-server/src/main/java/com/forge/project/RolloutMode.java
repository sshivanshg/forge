package com.forge.project;

/** How a new version of a project replaces the live one. */
public enum RolloutMode {
  /** Start the new version, health-check it, then switch all traffic at once. */
  BLUE_GREEN,
  /**
   * Start the new version, then shift traffic to it in steps while comparing its error rate and
   * latency with the live version; roll back on its own if it is worse.
   */
  CANARY
}
