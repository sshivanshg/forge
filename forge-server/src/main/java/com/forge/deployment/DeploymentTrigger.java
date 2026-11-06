package com.forge.deployment;

/** What started a deployment. */
public enum DeploymentTrigger {
  MANUAL,
  WEBHOOK,
  ROLLBACK,
  /** Forge found the live container gone and started the same image again. */
  RECOVERY
}
