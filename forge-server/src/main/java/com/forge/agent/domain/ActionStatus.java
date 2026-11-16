package com.forge.agent.domain;

import java.util.Map;
import java.util.Set;

/**
 * Lifecycle of a proposal. APPROVED is a short claim step: the owner's approval is committed before
 * the action runs, so two concurrent approvals cannot both execute it (the second one loses the
 * optimistic-lock race).
 *
 * <pre>
 * PROPOSED ─┬─► APPROVED ─┬─► EXECUTED
 *           │             └─► FAILED
 *           ├─► REJECTED
 *           └─► EXPIRED
 * </pre>
 */
public enum ActionStatus {
  PROPOSED,
  APPROVED,
  EXECUTED,
  REJECTED,
  FAILED,
  EXPIRED;

  private static final Map<ActionStatus, Set<ActionStatus>> NEXT =
      Map.of(
          PROPOSED, Set.of(APPROVED, REJECTED, EXPIRED),
          APPROVED, Set.of(EXECUTED, FAILED));

  public boolean canMoveTo(ActionStatus next) {
    return NEXT.getOrDefault(this, Set.of()).contains(next);
  }

  /** Still waiting for, or in the middle of, a decision. */
  public boolean isOpen() {
    return this == PROPOSED || this == APPROVED;
  }
}
