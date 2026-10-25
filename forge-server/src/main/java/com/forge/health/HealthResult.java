package com.forge.health;

import java.time.Duration;

/**
 * @param healthy whether the instance answered successfully
 * @param attempts how many requests were made
 * @param elapsed time spent waiting
 * @param detail last observation, e.g. "HTTP 200", "HTTP 500" or "Connection refused"
 */
public record HealthResult(boolean healthy, int attempts, Duration elapsed, String detail) {}
