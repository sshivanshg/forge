package com.forge.agent.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.forge.agent.domain.HealthPolicy.Verdict;
import org.junit.jupiter.api.Test;

class HealthPolicyTest {

  private static HealthWindow window(
      long requests, double errorRate, double latency, double baseline, int replicas) {
    return new HealthWindow(requests, errorRate, latency, baseline, replicas);
  }

  @Test
  void tooLittleTrafficIsNotJudged() {
    assertThat(HealthPolicy.assess(window(5, 0.6, 2000, 50, 1))).isEmpty();
  }

  @Test
  void manyErrorsRecommendARollback() {
    assertThat(HealthPolicy.assess(window(100, 0.2, 50, 50, 1))).contains(Verdict.ROLLBACK);
  }

  @Test
  void errorsWinOverSlowness() {
    assertThat(HealthPolicy.assess(window(100, 0.2, 2000, 50, 1))).contains(Verdict.ROLLBACK);
  }

  @Test
  void slowWithFewErrorsRecommendsScalingOut() {
    assertThat(HealthPolicy.assess(window(100, 0.01, 900, 100, 1))).contains(Verdict.SCALE_OUT);
  }

  @Test
  void smallAbsoluteSlowdownIsIgnored() {
    assertThat(HealthPolicy.assess(window(100, 0, 30, 5, 1))).isEmpty();
  }

  @Test
  void noBaselineYetMeansNoScaleOut() {
    assertThat(HealthPolicy.assess(window(100, 0, 2000, 0, 1))).isEmpty();
  }

  @Test
  void alreadyAtMaxReplicas() {
    assertThat(HealthPolicy.assess(window(100, 0.01, 900, 100, 3))).isEmpty();
  }

  @Test
  void healthyAppNeedsNothing() {
    assertThat(HealthPolicy.assess(window(100, 0.01, 110, 100, 1))).isEmpty();
  }
}
