package com.forge.runtime.infrastructure;

import com.forge.runtime.TrafficMetrics;
import com.forge.runtime.TrafficSample;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Adapter: reads Traefik's Prometheus endpoint. Traefik counts every request per service, and each
 * app version is its own service ({@link TraefikRoutes#serviceName}), so one scrape gives the
 * requests, 5xx responses and total response time of each version.
 */
class TraefikMetrics implements TrafficMetrics {

  private static final Logger log = LoggerFactory.getLogger(TraefikMetrics.class);
  private static final String REQUESTS = "traefik_service_requests_total{";
  private static final String DURATION_SUM = "traefik_service_request_duration_seconds_sum{";
  private static final Pattern LABEL = Pattern.compile("(\\w+)=\"([^\"]*)\"");

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
  private final URI endpoint;

  TraefikMetrics(String endpoint) {
    this.endpoint = URI.create(endpoint);
  }

  @Override
  public Optional<TrafficSample> sample(String routeName, UUID deploymentId) {
    try {
      HttpResponse<String> response =
          http.send(
              HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(3)).GET().build(),
              HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        log.warn("Traefik metrics answered {}", response.statusCode());
        return Optional.empty();
      }
      return Optional.of(
          parse(response.body(), TraefikRoutes.serviceName(routeName, deploymentId) + "@http"));
    } catch (IOException e) {
      log.warn("Could not read Traefik metrics at {}: {}", endpoint, e.getMessage());
      return Optional.empty();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return Optional.empty();
    }
  }

  /** Sums the series of one service in Prometheus text format. */
  static TrafficSample parse(String text, String service) {
    long requests = 0;
    long errors = 0;
    double latency = 0;
    for (String line : text.split("\n")) {
      boolean isRequests = line.startsWith(REQUESTS);
      if (!isRequests && !line.startsWith(DURATION_SUM)) {
        continue;
      }
      int close = line.lastIndexOf('}');
      Map<String, String> labels = labels(line.substring(line.indexOf('{') + 1, close));
      if (!service.equals(labels.get("service"))) {
        continue;
      }
      double value = Double.parseDouble(line.substring(close + 1).trim().split(" ")[0]);
      if (isRequests) {
        requests += (long) value;
        if (labels.getOrDefault("code", "").startsWith("5")) {
          errors += (long) value;
        }
      } else {
        latency += value;
      }
    }
    return new TrafficSample(requests, errors, latency);
  }

  private static Map<String, String> labels(String text) {
    Map<String, String> labels = new HashMap<>();
    Matcher m = LABEL.matcher(text);
    while (m.find()) {
      labels.put(m.group(1), m.group(2));
    }
    return labels;
  }
}
