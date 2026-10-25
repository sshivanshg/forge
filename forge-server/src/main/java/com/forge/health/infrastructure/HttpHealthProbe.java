package com.forge.health.infrastructure;

import com.forge.health.HealthProbe;
import com.forge.health.HealthResult;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.function.BooleanSupplier;
import org.springframework.stereotype.Component;

/** HTTP readiness probe using the JDK HTTP client. Any 2xx or 3xx answer counts as healthy. */
@Component
class HttpHealthProbe implements HealthProbe {

  static final Duration INTERVAL = Duration.ofSeconds(2);

  private final HttpClient client =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(2))
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();

  @Override
  public HealthResult awaitHealthy(
      URI baseUrl, String path, Duration timeout, BooleanSupplier stillAlive) {
    URI target = baseUrl.resolve(path);
    Instant start = Instant.now();
    Instant deadline = start.plus(timeout);
    int attempts = 0;
    String detail = "no response yet";
    while (Instant.now().isBefore(deadline)) {
      attempts++;
      try {
        HttpResponse<Void> response =
            client.send(
                HttpRequest.newBuilder(target).timeout(Duration.ofSeconds(3)).GET().build(),
                HttpResponse.BodyHandlers.discarding());
        detail = "HTTP " + response.statusCode() + " from " + path;
        if (response.statusCode() >= 200 && response.statusCode() < 400) {
          return new HealthResult(true, attempts, Duration.between(start, Instant.now()), detail);
        }
      } catch (IOException e) {
        detail =
            e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "");
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return new HealthResult(
            false, attempts, Duration.between(start, Instant.now()), "interrupted");
      }
      if (!stillAlive.getAsBoolean()) {
        return new HealthResult(
            false,
            attempts,
            Duration.between(start, Instant.now()),
            "process exited (" + detail + ")");
      }
      sleep();
    }
    return new HealthResult(
        false, attempts, Duration.between(start, Instant.now()), "timed out; last: " + detail);
  }

  private static void sleep() {
    try {
      Thread.sleep(INTERVAL);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
