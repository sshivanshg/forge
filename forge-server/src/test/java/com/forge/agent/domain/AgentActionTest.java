package com.forge.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class AgentActionTest {

  private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");
  private final UUID owner = UUID.randomUUID();

  private AgentAction proposal() {
    return AgentAction.propose(
        UUID.randomUUID(),
        UUID.randomUUID(),
        ActionSource.FAILURE_INVESTIGATION,
        ActionPlan.updateSettings(SettingsPatch.port(3000), "abc", "Set port", "app says 3000"),
        NOW);
  }

  @Test
  void startsProposedAndKeepsThePlan() {
    AgentAction action = proposal();
    assertThat(action.status()).isEqualTo(ActionStatus.PROPOSED);
    assertThat(action.type()).isEqualTo(ActionType.UPDATE_SETTINGS);
    assertThat(action.settings()).isEqualTo(SettingsPatch.port(3000));
    assertThat(action.commitSha()).isEqualTo("abc");
  }

  @Test
  void approvalThenExecutionRecordsWhoAndWhat() {
    AgentAction action = proposal();
    UUID deployment = UUID.randomUUID();
    action.approve(owner, NOW);
    action.executed(deployment, "Started", NOW.plusSeconds(1));
    assertThat(action.status()).isEqualTo(ActionStatus.EXECUTED);
    assertThat(action.decidedBy()).isEqualTo(owner);
    assertThat(action.resultDeploymentId()).isEqualTo(deployment);
  }

  @Test
  void cannotExecuteWithoutApproval() {
    AgentAction action = proposal();
    assertThatThrownBy(() -> action.executed(UUID.randomUUID(), "x", NOW))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void aDecidedActionCannotBeDecidedAgain() {
    AgentAction action = proposal();
    action.rejected(owner, NOW);
    assertThatThrownBy(() -> action.approve(owner, NOW)).isInstanceOf(IllegalStateException.class);
  }

  @ParameterizedTest
  @EnumSource(ActionStatus.class)
  void onlyOpenStatusesHaveSuccessors(ActionStatus from) {
    boolean hasSuccessor = false;
    for (ActionStatus to : ActionStatus.values()) {
      hasSuccessor |= from.canMoveTo(to);
    }
    assertThat(hasSuccessor).isEqualTo(from.isOpen());
  }

  @Test
  void plansValidateTheirRequiredFields() {
    assertThatThrownBy(() -> new ActionPlan(ActionType.ROLLBACK, "t", "r", null, null, null))
        .isInstanceOf(NullPointerException.class);
    assertThatThrownBy(
            () ->
                ActionPlan.updateSettings(
                    new SettingsPatch(null, null, null, null, null), null, "t", "r"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(ActionPlan.redeploy(null, "t", "r").commitSha()).isNull();
  }
}
