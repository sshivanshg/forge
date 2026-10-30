package com.forge.deployment;

import static com.forge.deployment.DeploymentStatus.BUILDING;
import static com.forge.deployment.DeploymentStatus.CANCELLED;
import static com.forge.deployment.DeploymentStatus.DEPLOYING;
import static com.forge.deployment.DeploymentStatus.FAILED;
import static com.forge.deployment.DeploymentStatus.HEALTH_CHECKING;
import static com.forge.deployment.DeploymentStatus.LIVE;
import static com.forge.deployment.DeploymentStatus.QUEUED;
import static com.forge.deployment.DeploymentStatus.STOPPED;
import static com.forge.deployment.DeploymentStatus.SUPERSEDED;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** The state machine is the heart of the system, so every edge (and non-edge) is tested. */
class DeploymentStatusTest {

  private static final Map<DeploymentStatus, Set<DeploymentStatus>> EXPECTED =
      Map.of(
          QUEUED, EnumSet.of(BUILDING, DEPLOYING, CANCELLED),
          BUILDING, EnumSet.of(DEPLOYING, FAILED, CANCELLED),
          DEPLOYING, EnumSet.of(HEALTH_CHECKING, FAILED),
          HEALTH_CHECKING, EnumSet.of(LIVE, FAILED),
          LIVE, EnumSet.of(SUPERSEDED, STOPPED),
          FAILED, EnumSet.noneOf(DeploymentStatus.class),
          CANCELLED, EnumSet.noneOf(DeploymentStatus.class),
          SUPERSEDED, EnumSet.noneOf(DeploymentStatus.class),
          STOPPED, EnumSet.noneOf(DeploymentStatus.class));

  @ParameterizedTest
  @EnumSource(DeploymentStatus.class)
  void allowsExactlyTheDocumentedTransitions(DeploymentStatus from) {
    for (DeploymentStatus to : DeploymentStatus.values()) {
      assertThat(from.canTransitionTo(to))
          .as("%s -> %s", from, to)
          .isEqualTo(EXPECTED.get(from).contains(to));
    }
  }

  @Test
  void terminalStatesHaveNoWayOut() {
    assertThat(EnumSet.allOf(DeploymentStatus.class).stream().filter(DeploymentStatus::isTerminal))
        .containsExactlyInAnyOrder(FAILED, CANCELLED, SUPERSEDED, STOPPED);
  }

  @Test
  void onlyPipelineStatesCountAsInProgress() {
    assertThat(
            EnumSet.allOf(DeploymentStatus.class).stream().filter(DeploymentStatus::isInProgress))
        .containsExactlyInAnyOrder(BUILDING, DEPLOYING, HEALTH_CHECKING);
  }
}
