package com.forge.logs;

import java.util.UUID;

/**
 * Write side of deployment logs. Builders and deployers only need this one method (Interface
 * Segregation): they cannot read or stream logs.
 */
public interface LogSink {

  /** Persists the line and pushes it to every live viewer. Multi-line text is split. */
  void append(UUID deploymentId, LogSource source, String text);
}
