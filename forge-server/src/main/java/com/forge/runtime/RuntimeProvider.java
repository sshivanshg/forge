package com.forge.runtime;

import java.io.Closeable;
import java.util.List;
import java.util.function.Consumer;

/**
 * Port to the data plane: where user apps actually run. The deployment pipeline only knows this
 * interface; {@code DockerRuntimeProvider} implements it today, and a Kubernetes provider could
 * replace it without touching the pipeline (Liskov Substitution + Dependency Inversion).
 */
public interface RuntimeProvider {

  /** Creates and starts an instance. It may not be healthy yet. */
  RunningInstance start(ContainerSpec spec);

  /** After a successful health check: keep the instance running across crashes and reboots. */
  void promote(String instanceId);

  /** Stops and removes the instance. Idempotent: stopping a missing instance is not an error. */
  void stop(String instanceId);

  boolean isRunning(String instanceId);

  /** Human-readable reason an instance stopped, e.g. "exited with code 1". */
  String exitDescription(String instanceId);

  /** Last {@code lines} lines of the instance's stdout/stderr. */
  List<String> recentOutput(String instanceId, int lines);

  /** Streams output live until the returned handle is closed. */
  Closeable followOutput(String instanceId, int tail, Consumer<String> lineConsumer);
}
