package com.forge.agent.domain;

/**
 * What a LIVE app's traffic looked like over one watch interval.
 *
 * @param requests requests answered in the interval
 * @param errorRate share of them that were 5xx, 0 to 1
 * @param meanLatencyMillis mean response time in the interval
 * @param baselineLatencyMillis the same app's usual mean latency, learned from earlier healthy
 *     intervals; 0 while the watcher has not learned it yet
 * @param replicas how many replicas serve the app now (1 to 3)
 */
public record HealthWindow(
    long requests,
    double errorRate,
    double meanLatencyMillis,
    double baselineLatencyMillis,
    int replicas) {}
