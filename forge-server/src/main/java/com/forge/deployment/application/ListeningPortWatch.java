package com.forge.deployment.application;

import com.forge.runtime.RuntimeProvider;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ends a health check early when the app says it is listening on a different port than the
 * project's. Without this a wrong port costs the whole health timeout (90 s) although the app
 * announced the problem in its first log lines.
 *
 * <p>Reads the app's output at most every few seconds, so the container engine isn't queried on
 * every probe.
 */
final class ListeningPortWatch {

  private static final Pattern ANNOUNCED_PORT =
      Pattern.compile(
          "(?i)\\b(?:listening|started|running|serving)\\b.{0,40}?"
              + "(?:\\bport\\s*[:=]?\\s*|https?://[\\w.\\[\\]-]*:)(\\d{2,5})\\b");
  private static final Duration GRACE = Duration.ofSeconds(5);
  private static final Duration EVERY = Duration.ofSeconds(3);
  private static final int LINES = 40;

  private final RuntimeProvider runtime;
  private final String instanceId;
  private final int expectedPort;
  private final Instant start = Instant.now();
  private Instant lastCheck = start;
  private String problem;

  ListeningPortWatch(RuntimeProvider runtime, String instanceId, int expectedPort) {
    this.runtime = runtime;
    this.instanceId = instanceId;
    this.expectedPort = expectedPort;
  }

  /** False once the app has announced another port: waiting longer cannot help. */
  boolean portLooksRight() {
    Instant now = Instant.now();
    if (problem == null && now.isAfter(start.plus(GRACE)) && now.isAfter(lastCheck.plus(EVERY))) {
      lastCheck = now;
      List<Integer> announced = announcedPorts(runtime.recentOutput(instanceId, LINES));
      // An app may announce several ports (e.g. a separate management port): only a mismatch if
      // none of them is the one Forge routes to
      if (!announced.isEmpty() && !announced.contains(expectedPort)) {
        problem =
            "app is listening on port "
                + announced.getLast()
                + ", but the project expects "
                + expectedPort;
      }
    }
    return problem == null;
  }

  Optional<String> problem() {
    return Optional.ofNullable(problem);
  }

  /** Every port the app announced it listens on, in order. */
  static List<Integer> announcedPorts(List<String> lines) {
    List<Integer> ports = new ArrayList<>();
    for (String line : lines) {
      Matcher m = ANNOUNCED_PORT.matcher(line);
      if (m.find()) {
        ports.add(Integer.parseInt(m.group(1)));
      }
    }
    return ports;
  }
}
