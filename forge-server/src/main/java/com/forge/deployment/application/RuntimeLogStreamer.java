package com.forge.deployment.application;

import com.forge.deployment.domain.RuntimeInstanceRecord;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.RuntimeProvider;
import java.io.Closeable;
import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Streams the live app's stdout/stderr to the browser. Runtime output is not stored: it is piped
 * straight from the container to the Server-Sent Events connection.
 */
@Service
public class RuntimeLogStreamer {

  private static final int INITIAL_TAIL = 200;

  private final ProjectCatalog projects;
  private final DeploymentTransitions transitions;
  private final RuntimeProvider runtime;

  public RuntimeLogStreamer(
      ProjectCatalog projects, DeploymentTransitions transitions, RuntimeProvider runtime) {
    this.projects = projects;
    this.transitions = transitions;
    this.runtime = runtime;
  }

  public SseEmitter stream(UUID projectId, UUID userId) {
    ProjectSnapshot project = projects.getOwned(projectId, userId);
    SseEmitter emitter = new SseEmitter(0L);
    if (project.liveDeploymentId() == null) {
      sendAndComplete(emitter, "No live deployment yet. Deploy the project to see its logs.");
      return emitter;
    }
    RuntimeInstanceRecord instance =
        transitions.instancesOf(project.liveDeploymentId()).stream()
            .filter(i -> i.status() != RuntimeInstanceRecord.Status.STOPPED)
            .findFirst()
            .orElse(null); // with several replicas, follow the first one still running
    if (instance == null || instance.status() == RuntimeInstanceRecord.Status.STOPPED) {
      sendAndComplete(emitter, "The app is not running.");
      return emitter;
    }
    Closeable follow =
        runtime.followOutput(
            instance.externalId(),
            INITIAL_TAIL,
            line -> {
              try {
                synchronized (emitter) {
                  emitter.send(
                      SseEmitter.event()
                          .name("log")
                          .data(
                              Map.of("line", line, "ts", Instant.now().toString()),
                              MediaType.APPLICATION_JSON));
                }
              } catch (IOException | IllegalStateException clientGone) {
                emitter.complete();
              }
            });
    Runnable close =
        () -> {
          try {
            follow.close();
          } catch (IOException ignored) {
            // stream already closed
          }
        };
    emitter.onCompletion(close);
    emitter.onTimeout(close);
    emitter.onError(e -> close.run());
    return emitter;
  }

  private static void sendAndComplete(SseEmitter emitter, String message) {
    try {
      emitter.send(
          SseEmitter.event()
              .name("log")
              .data(
                  Map.of("line", message, "ts", Instant.now().toString()),
                  MediaType.APPLICATION_JSON));
    } catch (IOException ignored) {
      // client already gone
    }
    emitter.complete();
  }
}
