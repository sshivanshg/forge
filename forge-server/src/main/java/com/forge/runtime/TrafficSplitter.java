package com.forge.runtime;

import java.util.UUID;

/**
 * Port: control over how the reverse proxy divides one app's traffic between its versions (the
 * deployments that have running instances). Only engines whose routes Forge serves itself have it
 * (Apple container); with Docker, Traefik reads immutable container labels, so canary rollouts fall
 * back to blue-green there.
 */
public interface TrafficSplitter {

  /**
   * Sends {@code percent} of the route's traffic to the instances of {@code deploymentId} and the
   * rest to the route's other versions.
   */
  void split(String routeName, UUID deploymentId, int percent);

  /** Back to the default: every running version gets an equal share. */
  void reset(String routeName);
}
