package com.forge.deployment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.forge.deployment.domain.Deployment;
import com.forge.deployment.domain.IllegalStateTransitionException;
import com.forge.shared.error.ValidationException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.DomainEvents;

class DeploymentTest {

  private static final String SHA = "a".repeat(40);
  private static final Instant NOW = Instant.parse("2026-10-26T10:00:00Z");
  private final UUID projectId = UUID.randomUUID();

  @Test
  void newDeploymentIsQueuedAndAnnouncesIt() {
    Deployment d = request();

    assertThat(d.status()).isEqualTo(DeploymentStatus.QUEUED);
    assertThat(events(d))
        .singleElement()
        .satisfies(
            e -> {
              assertThat(e.from()).isNull();
              assertThat(e.to()).isEqualTo(DeploymentStatus.QUEUED);
            });
  }

  @Test
  void happyPathWalksTheStateMachine() {
    Deployment d = request();
    d.startBuild(NOW);
    d.buildSucceeded("localhost:5001/forge/app:abc", "fix: things", NOW);
    d.startHealthCheck(NOW);
    d.goLive(NOW);

    assertThat(d.status()).isEqualTo(DeploymentStatus.LIVE);
    assertThat(d.imageRef()).isEqualTo("localhost:5001/forge/app:abc");
    assertThat(d.finishedAt()).isEqualTo(NOW);
    assertThat(events(d))
        .extracting(DeploymentStatusChanged::to)
        .containsExactly(
            DeploymentStatus.QUEUED,
            DeploymentStatus.BUILDING,
            DeploymentStatus.DEPLOYING,
            DeploymentStatus.HEALTH_CHECKING,
            DeploymentStatus.LIVE);
  }

  @Test
  void rejectsIllegalTransitionsAndKeepsState() {
    Deployment d = request();

    assertThatThrownBy(() -> d.goLive(NOW)).isInstanceOf(IllegalStateTransitionException.class);
    assertThat(d.status()).isEqualTo(DeploymentStatus.QUEUED);
  }

  @Test
  void failureRecordsReasonAndIsTerminal() {
    Deployment d = request();
    d.startBuild(NOW);
    d.fail(FailureReason.BUILD_FAILED, "compile error", NOW);

    assertThat(d.status()).isEqualTo(DeploymentStatus.FAILED);
    assertThat(d.failureReason()).isEqualTo(FailureReason.BUILD_FAILED);
    assertThatThrownBy(() -> d.fail(FailureReason.UNHEALTHY, "again", NOW))
        .isInstanceOf(IllegalStateTransitionException.class);
    assertThat(d.failureReason()).isEqualTo(FailureReason.BUILD_FAILED);
  }

  @Test
  void rollbackReusesTheImageAndSkipsTheBuild() {
    Deployment live = request();
    live.startBuild(NOW);
    live.buildSucceeded("img:1", null, NOW);
    live.startHealthCheck(NOW);
    live.goLive(NOW);

    Deployment rollback = Deployment.rollbackTo(live, UUID.randomUUID(), NOW);
    rollback.startDeployWithExistingImage(NOW);

    assertThat(rollback.trigger()).isEqualTo(DeploymentTrigger.ROLLBACK);
    assertThat(rollback.rollbackOfId()).isEqualTo(live.id());
    assertThat(rollback.imageRef()).isEqualTo("img:1");
    assertThat(rollback.status()).isEqualTo(DeploymentStatus.DEPLOYING);
  }

  @Test
  void recoveryRestartsTheLiveImageWithoutAUser() {
    Deployment live = request();
    live.startBuild(NOW);
    live.buildSucceeded("img:1", null, NOW);
    live.startHealthCheck(NOW);
    live.goLive(NOW);

    Deployment recovery = Deployment.recoveryOf(live, NOW);

    assertThat(recovery.trigger()).isEqualTo(DeploymentTrigger.RECOVERY);
    assertThat(recovery.rollbackOfId()).isEqualTo(live.id());
    assertThat(recovery.imageRef()).isEqualTo("img:1");
    assertThatThrownBy(
            () ->
                Deployment.request(
                    live.projectId(),
                    live.commitSha(),
                    null,
                    DeploymentTrigger.RECOVERY,
                    null,
                    NOW))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void cannotRollBackToADeploymentThatNeverWentLive() {
    Deployment failed = request();
    failed.startBuild(NOW);
    failed.fail(FailureReason.BUILD_FAILED, "x", NOW);

    assertThat(failed.canBeRolledBackTo()).isFalse();
    assertThatThrownBy(() -> Deployment.rollbackTo(failed, null, NOW))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void normalDeploymentCannotSkipTheBuild() {
    Deployment d = request();
    assertThatThrownBy(() -> d.startDeployWithExistingImage(NOW))
        .isInstanceOf(IllegalStateTransitionException.class);
  }

  @Test
  void rejectsMalformedCommitSha() {
    assertThatThrownBy(
            () ->
                Deployment.request(
                    projectId, "not-a-sha", null, DeploymentTrigger.MANUAL, null, NOW))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void cancellableOnlyBeforeDeploying() {
    Deployment d = request();
    assertThat(d.isCancellable()).isTrue();
    d.startBuild(NOW);
    assertThat(d.isCancellable()).isTrue();
    d.buildSucceeded("img", null, NOW);
    assertThat(d.isCancellable()).isFalse();
  }

  private Deployment request() {
    return Deployment.request(projectId, SHA, "msg", DeploymentTrigger.MANUAL, null, NOW);
  }

  /** Reads the events the aggregate registered (what Spring Data would publish on save). */
  @SuppressWarnings("unchecked")
  private static List<DeploymentStatusChanged> events(Deployment d) {
    try {
      var method =
          org.springframework.data.domain.AbstractAggregateRoot.class.getDeclaredMethod(
              "domainEvents");
      method.setAccessible(true);
      assertThat(method.isAnnotationPresent(DomainEvents.class)).isTrue();
      return (List<DeploymentStatusChanged>) (List<?>) method.invoke(d);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError(e);
    }
  }
}
