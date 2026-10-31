package com.forge.runtime;

/**
 * Cumulative request counters of one app version, as the reverse proxy measured them. Subtract two
 * samples ({@link #minus}) to get what happened in between.
 *
 * @param requests every request answered
 * @param serverErrors requests answered with a 5xx status
 * @param latencySeconds sum of all response times
 */
public record TrafficSample(long requests, long serverErrors, double latencySeconds) {

  public static final TrafficSample NONE = new TrafficSample(0, 0, 0);

  public TrafficSample minus(TrafficSample earlier) {
    return new TrafficSample(
        requests - earlier.requests,
        serverErrors - earlier.serverErrors,
        latencySeconds - earlier.latencySeconds);
  }

  /** Share of requests that failed with a 5xx, between 0 and 1 (0 without traffic). */
  public double errorRate() {
    return requests == 0 ? 0 : (double) serverErrors / requests;
  }

  /** Mean response time in milliseconds (0 without traffic). */
  public double meanLatencyMillis() {
    return requests == 0 ? 0 : latencySeconds * 1000 / requests;
  }
}
