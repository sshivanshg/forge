package com.forge.runtime.api;

import com.forge.runtime.application.RoutingTable;
import com.forge.runtime.infrastructure.RuntimeProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the routing table to the reverse proxy. Traefik polls this every second (its HTTP
 * provider), so routes follow deployments within about a second. Protected by a shared token rather
 * than a user JWT, because the caller is infrastructure, not a person.
 */
@RestController
class RoutingController {

  static final String TOKEN_HEADER = "X-Forge-Routing-Token";

  private final ObjectProvider<RoutingTable> routing;
  private final RuntimeProperties properties;

  RoutingController(ObjectProvider<RoutingTable> routing, RuntimeProperties properties) {
    this.routing = routing;
    this.properties = properties;
  }

  @GetMapping("/internal/routing")
  ResponseEntity<Map<String, Object>> routing(
      @RequestHeader(name = TOKEN_HEADER, required = false) String token) {
    RoutingTable table = routing.getIfAvailable();
    if (table == null) {
      return ResponseEntity.notFound().build(); // the Docker engine routes by labels instead
    }
    if (!tokenMatches(token)) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    return ResponseEntity.ok(table.current());
  }

  private boolean tokenMatches(String token) {
    String expected = properties.routingToken();
    if (expected == null || expected.isBlank() || token == null) {
      return false;
    }
    return MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8));
  }
}
