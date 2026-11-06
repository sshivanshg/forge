package com.forge.deployment;

/** Why a deployment ended in FAILED. */
public enum FailureReason {
  SOURCE_UNAVAILABLE,
  UNSUPPORTED_PROJECT,
  BUILD_FAILED,
  BUILD_TIMEOUT,
  PUSH_FAILED,
  RUNTIME_ERROR,
  UNHEALTHY,
  /** Healthy, but worse than the live version on real traffic during a canary rollout. */
  CANARY_REGRESSION,
  INTERNAL_ERROR
}
