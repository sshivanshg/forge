package com.forge.runtime;

import java.util.Optional;
import java.util.UUID;

/** Port: what the reverse proxy has measured for one version of an app. */
public interface TrafficMetrics {

  /**
   * Counters for the instances of {@code deploymentId} on {@code routeName}, cumulative since the
   * proxy started. Empty when the proxy has not seen that version or cannot be reached.
   */
  Optional<TrafficSample> sample(String routeName, UUID deploymentId);
}
