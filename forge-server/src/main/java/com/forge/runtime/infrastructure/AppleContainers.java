package com.forge.runtime.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.shared.container.ContainerCli;
import com.forge.shared.error.ExternalServiceException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Reads container state from Apple's {@code container ls/inspect --format json} output. */
class AppleContainers {

  /** What Forge needs to know about one container. */
  record Info(String id, String state, String ipv4, Map<String, String> labels) {
    boolean running() {
      return "running".equals(state);
    }
  }

  private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(20);

  private final ContainerCli cli;
  private final ObjectMapper json;

  AppleContainers(ContainerCli cli, ObjectMapper json) {
    this.cli = cli;
    this.json = json;
  }

  List<Info> list() {
    ContainerCli.Result result = cli.run(QUERY_TIMEOUT, "list", "--all", "--format", "json");
    if (!result.ok()) {
      throw new ExternalServiceException("container list failed: " + result.text(), null);
    }
    return parse(result.text());
  }

  /** Empty when the container doesn't exist. */
  Optional<Info> inspect(String id) {
    ContainerCli.Result result = cli.run(QUERY_TIMEOUT, "inspect", id);
    if (!result.ok()) {
      return Optional.empty();
    }
    return parse(result.text()).stream().findFirst();
  }

  List<Info> parse(String text) {
    List<Info> containers = new ArrayList<>();
    try {
      for (JsonNode node : json.readTree(text)) {
        JsonNode status = node.path("status");
        String ip = null;
        for (JsonNode network : status.path("networks")) {
          String address = network.path("ipv4Address").asText("");
          if (!address.isEmpty()) {
            ip =
                address.substring(
                    0, address.indexOf('/') < 0 ? address.length() : address.indexOf('/'));
            break;
          }
        }
        Map<String, String> labels = new LinkedHashMap<>();
        node.path("configuration")
            .path("labels")
            .fields()
            .forEachRemaining(e -> labels.put(e.getKey(), e.getValue().asText()));
        containers.add(
            new Info(node.path("id").asText(), status.path("state").asText(), ip, labels));
      }
    } catch (Exception e) {
      throw new ExternalServiceException("Unexpected output from container: " + e.getMessage(), e);
    }
    return containers;
  }
}
