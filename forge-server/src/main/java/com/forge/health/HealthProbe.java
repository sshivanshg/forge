package com.forge.health;

import java.net.URI;
import java.time.Duration;
import java.util.function.BooleanSupplier;

/** Decides whether a freshly started instance is ready to receive traffic. */
public interface HealthProbe {

  /**
   * Polls {@code baseUrl + path} until it answers 2xx/3xx or {@code timeout} passes.
   *
   * @param stillAlive checked between attempts; returning false ends the wait immediately (the
   *     process crashed, so waiting longer cannot help)
   */
  HealthResult awaitHealthy(URI baseUrl, String path, Duration timeout, BooleanSupplier stillAlive);
}
