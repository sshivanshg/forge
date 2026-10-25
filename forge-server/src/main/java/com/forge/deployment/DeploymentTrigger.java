package com.forge.deployment;

/** What started a deployment. */
public enum DeploymentTrigger {
  MANUAL,
  WEBHOOK,
  ROLLBACK
}
