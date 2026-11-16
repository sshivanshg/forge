package com.forge.agent.domain;

/** What an approved agent action does. Every type is a change the owner must approve first. */
public enum ActionType {
  /** Route traffic back to an older deployment's image, without a build. */
  ROLLBACK,
  /** Build and deploy a commit again. */
  REDEPLOY,
  /** Raise the replica count, then redeploy the live commit so it takes effect. */
  SCALE_OUT,
  /** Change build or run settings, then redeploy the commit that failed. */
  UPDATE_SETTINGS
}
