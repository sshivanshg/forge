package com.forge.logs;

import java.util.UUID;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Live (Server-Sent Events) side of deployment logs. */
public interface LogStreams {

  /**
   * Opens a stream: first replays stored lines after {@code afterSeq}, then pushes new lines and
   * status changes as they happen.
   */
  SseEmitter subscribe(UUID deploymentId, int afterSeq);

  /**
   * Pushes a status change to viewers. When {@code terminal} is true a final {@code done} event is
   * sent and the streams are closed.
   */
  void publishStatus(UUID deploymentId, String status, String failureReason, boolean terminal);
}
