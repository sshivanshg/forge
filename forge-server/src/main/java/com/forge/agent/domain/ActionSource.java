package com.forge.agent.domain;

/** Which part of the agent proposed an action. */
public enum ActionSource {
  /** After a deployment failed. */
  FAILURE_INVESTIGATION,
  /** The live health watcher saw a LIVE app degrade. */
  HEALTH_WATCH,
  /** Forge could not detect how to build a repository and the agent inspected it. */
  AUTO_CONFIGURE
}
