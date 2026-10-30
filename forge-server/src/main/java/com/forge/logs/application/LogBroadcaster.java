package com.forge.logs.application;

import com.forge.logs.LogLine;
import com.forge.logs.LogReader;
import com.forge.logs.LogStreams;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Fan-out of live log lines and status changes to every open browser stream (Observer pattern: each
 * {@link Subscriber} observes one deployment).
 *
 * <p>Thread safety: the registry is a {@link ConcurrentHashMap} of {@link CopyOnWriteArrayList}s
 * (many readers, rare writers) and each subscriber serialises its own sends, because the builder
 * thread and the replaying request thread may write to the same stream concurrently.
 */
@Component
public class LogBroadcaster implements LogStreams {

  private static final int REPLAY_LIMIT = 10_000;

  private final Map<UUID, List<Subscriber>> subscribers = new ConcurrentHashMap<>();
  private final List<Consumer<UUID>> terminalListeners = new CopyOnWriteArrayList<>();
  private final LogReader reader;

  public LogBroadcaster(@Lazy LogReader reader) {
    this.reader = reader;
  }

  @Override
  public SseEmitter subscribe(UUID deploymentId, int afterSeq) {
    SseEmitter emitter = new SseEmitter(0L);
    Subscriber subscriber = new Subscriber(emitter, afterSeq);
    subscribers.computeIfAbsent(deploymentId, id -> new CopyOnWriteArrayList<>()).add(subscriber);
    Runnable remove = () -> unsubscribe(deploymentId, subscriber);
    emitter.onCompletion(remove);
    emitter.onTimeout(remove);
    emitter.onError(e -> remove.run());
    // Replay after registering, so no line can fall between replay and live delivery;
    // the subscriber drops anything it has already sent (by seq).
    reader.after(deploymentId, afterSeq, REPLAY_LIMIT).forEach(subscriber::sendLine);
    return emitter;
  }

  public void publishLine(UUID deploymentId, LogLine line) {
    subscribers.getOrDefault(deploymentId, List.of()).forEach(s -> s.sendLine(line));
  }

  @Override
  public void publishStatus(
      UUID deploymentId, String status, String failureReason, boolean terminal) {
    List<Subscriber> current = subscribers.getOrDefault(deploymentId, List.of());
    current.forEach(s -> s.sendStatus(status, failureReason, terminal));
    if (terminal) {
      subscribers.remove(deploymentId);
      terminalListeners.forEach(listener -> listener.accept(deploymentId));
    }
  }

  /** Lets the store release per-deployment state once a deployment has finished. */
  public void onTerminal(Consumer<UUID> listener) {
    terminalListeners.add(listener);
  }

  /** SSE comment every 15 s so proxies and browsers do not close idle streams. */
  @Scheduled(fixedRate = 15_000)
  void keepAlive() {
    subscribers.values().forEach(list -> list.forEach(Subscriber::ping));
  }

  int subscriberCount(UUID deploymentId) {
    return subscribers.getOrDefault(deploymentId, List.of()).size();
  }

  private void unsubscribe(UUID deploymentId, Subscriber subscriber) {
    subscribers.computeIfPresent(
        deploymentId,
        (id, list) -> {
          list.remove(subscriber);
          return list.isEmpty() ? null : list;
        });
  }

  /** One open browser stream. */
  static final class Subscriber {

    private final SseEmitter emitter;
    private int lastSentSeq;
    private boolean closed;

    Subscriber(SseEmitter emitter, int afterSeq) {
      this.emitter = emitter;
      this.lastSentSeq = afterSeq;
    }

    synchronized void sendLine(LogLine line) {
      if (closed || line.seq() <= lastSentSeq) {
        return;
      }
      send(
          SseEmitter.event()
              .name("log")
              .id(String.valueOf(line.seq()))
              .data(line, MediaType.APPLICATION_JSON));
      lastSentSeq = line.seq();
    }

    synchronized void sendStatus(String status, String failureReason, boolean terminal) {
      if (closed) {
        return;
      }
      var payload = new java.util.HashMap<String, Object>();
      payload.put("status", status);
      payload.put("failureReason", failureReason);
      send(SseEmitter.event().name("status").data(payload, MediaType.APPLICATION_JSON));
      if (terminal) {
        send(
            SseEmitter.event()
                .name("done")
                .data(Map.of("status", status), MediaType.APPLICATION_JSON));
        closed = true;
        emitter.complete();
      }
    }

    synchronized void ping() {
      if (!closed) {
        send(SseEmitter.event().comment("keep-alive"));
      }
    }

    private void send(SseEmitter.SseEventBuilder event) {
      try {
        emitter.send(event);
      } catch (IOException | IllegalStateException e) {
        closed = true; // browser went away; the emitter callbacks unregister us
      }
    }
  }
}
