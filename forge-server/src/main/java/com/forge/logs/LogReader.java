package com.forge.logs;

import java.util.List;
import java.util.UUID;

/** Read side of deployment logs. */
public interface LogReader {

  /** Lines with {@code seq > afterSeq}, oldest first. */
  List<LogLine> after(UUID deploymentId, int afterSeq, int limit);

  /** The last {@code count} lines, oldest first. */
  List<LogLine> tail(UUID deploymentId, int count);
}
