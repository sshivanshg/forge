package com.forge.deployment.application;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param healthTimeout how long a new instance has to become healthy before the deploy fails
 * @param drainDelay pause between the new instance going live and the old one being stopped, so the
 *     proxy has time to route to the new instance
 * @param busyRetryDelay when another deployment of the project is in progress, try again after this
 * @param selfHeal redeploy a live version's image when its container disappears
 * @param canary how canary rollouts shift traffic and judge the new version
 */
@ConfigurationProperties("forge.deploy")
public record DeploymentProperties(
    @DefaultValue("90s") Duration healthTimeout,
    @DefaultValue("3s") Duration drainDelay,
    @DefaultValue("15s") Duration busyRetryDelay,
    @DefaultValue("true") boolean selfHeal,
    @DefaultValue Canary canary) {

  /**
   * @param steps share of traffic (percent) the new version gets at each step before it takes all
   * @param stepDuration how long each step is watched
   * @param minRequests fewer requests than this to the new version in a step: too little to judge
   * @param maxErrorRateIncrease roll back if the new version's 5xx rate is higher than the live
   *     version's by more than this (0.05 = 5 percentage points)
   * @param maxLatencyFactor roll back if the new version's mean latency is this many times the live
   *     version's (and at least {@code minLatencyIncrease} slower)
   * @param minLatencyIncrease ignore latency differences smaller than this
   * @param syntheticRps test requests per second Forge sends through the proxy during a canary, so
   *     even an app without visitors can be judged (0 = only real traffic)
   * @param proxyUrl where Forge sends those requests: the proxy's web entrypoint
   */
  public record Canary(
      @DefaultValue({"20", "50"}) List<Integer> steps,
      @DefaultValue("15s") Duration stepDuration,
      @DefaultValue("20") int minRequests,
      @DefaultValue("0.05") double maxErrorRateIncrease,
      @DefaultValue("2.0") double maxLatencyFactor,
      @DefaultValue("200ms") Duration minLatencyIncrease,
      @DefaultValue("10") int syntheticRps,
      @DefaultValue("http://127.0.0.1:80") String proxyUrl) {}
}
