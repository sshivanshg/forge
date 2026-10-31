package com.forge.deployment.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.forge.deployment.application.CanaryAnalysis.Outcome;
import com.forge.runtime.TrafficSample;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class CanaryAnalysisTest {

  private final CanaryAnalysis analysis =
      new CanaryAnalysis(
          new DeploymentProperties.Canary(
              List.of(20, 50),
              Duration.ofSeconds(15),
              20,
              0.05,
              2.0,
              Duration.ofMillis(200),
              0,
              "http://127.0.0.1"));

  @Test
  void asGoodAsTheLiveVersionPasses() {
    var verdict = analysis.judge(traffic(40, 0, 20), traffic(160, 0, 18));

    assertThat(verdict.outcome()).isEqualTo(Outcome.HEALTHY);
    assertThat(verdict.summary()).contains("40 requests", "0.0% errors");
  }

  @Test
  void clearlyMoreServerErrorsThanTheLiveVersionIsARegression() {
    var verdict = analysis.judge(traffic(40, 8, 20), traffic(160, 0, 18));

    assertThat(verdict.regression()).isTrue();
    assertThat(verdict.summary()).startsWith("error rate is 20.0% higher");
  }

  @Test
  void errorsTheLiveVersionAlsoHasAreNotBlamedOnTheNewOne() {
    // e.g. a shared database is down: both versions fail about as often
    var verdict = analysis.judge(traffic(40, 12, 20), traffic(160, 44, 18));

    assertThat(verdict.outcome()).isEqualTo(Outcome.HEALTHY);
  }

  @Test
  void muchSlowerResponsesAreARegression() {
    var verdict = analysis.judge(traffic(40, 0, 900), traffic(160, 0, 30));

    assertThat(verdict.regression()).isTrue();
    assertThat(verdict.summary()).startsWith("responses are much slower");
  }

  @Test
  void aSmallSlowdownIsTolerated() {
    // three times slower, but only by 40 ms: below the minimum difference worth acting on
    var verdict = analysis.judge(traffic(40, 0, 60), traffic(160, 0, 20));

    assertThat(verdict.outcome()).isEqualTo(Outcome.HEALTHY);
  }

  @Test
  void tooLittleTrafficIsInconclusiveRatherThanAPass() {
    var verdict = analysis.judge(traffic(5, 5, 20), traffic(20, 0, 20));

    assertThat(verdict.outcome()).isEqualTo(Outcome.INCONCLUSIVE);
    assertThat(verdict.summary()).contains("only 5 request(s)");
  }

  /** {@code requests} requests, {@code errors} of them 5xx, {@code meanMs} average latency. */
  private static TrafficSample traffic(long requests, long errors, double meanMs) {
    return new TrafficSample(requests, errors, requests * meanMs / 1000);
  }
}
