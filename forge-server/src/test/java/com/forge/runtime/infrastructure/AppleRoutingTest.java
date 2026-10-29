package com.forge.runtime.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.runtime.ContainerSpec;
import com.forge.runtime.infrastructure.TraefikRoutes.Route;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AppleRoutingTest {

  private final AppleContainers parser = new AppleContainers(null, new ObjectMapper());

  @Test
  void parsesStateIpAndLabelsFromContainerListJson() {
    String json =
        """
        [{"id":"forge-shop-1",
          "status":{"state":"running","networks":[{"ipv4Address":"192.168.64.9/24"}]},
          "configuration":{"labels":{"forge.route":"shop"}}},
         {"id":"old","status":{"state":"stopped","networks":[]},"configuration":{"labels":{}}}]
        """;

    List<AppleContainers.Info> containers = parser.parse(json);

    assertThat(containers).hasSize(2);
    assertThat(containers.getFirst().ipv4()).isEqualTo("192.168.64.9");
    assertThat(containers.getFirst().running()).isTrue();
    assertThat(containers.getFirst().labels()).containsEntry("forge.route", "shop");
    assertThat(containers.get(1).running()).isFalse();
    assertThat(containers.get(1).ipv4()).isNull();
  }

  @Test
  void blueAndGreenOfOneProjectShareARoute() {
    Map<String, String> labels =
        AppleContainerRuntimeProvider.labels(spec("shop", "shop.localhost", "/health"));

    List<Route> routes =
        AppleRoutingTable.routes(
            List.of(
                new AppleContainers.Info("blue", "running", "192.168.64.2", labels),
                new AppleContainers.Info("green", "running", "192.168.64.3", labels)));

    assertThat(routes).hasSize(1);
    assertThat(routes.getFirst().host()).isEqualTo("shop.localhost");
    assertThat(routes.getFirst().healthPath()).isEqualTo("/health");
    assertThat(routes.getFirst().servers())
        .containsExactly("http://192.168.64.2:3000", "http://192.168.64.3:3000");
  }

  @Test
  void stoppedForeignAndAddresslessContainersAreNotRouted() {
    Map<String, String> labels = AppleContainerRuntimeProvider.labels(spec("shop", "s", "/"));

    List<Route> routes =
        AppleRoutingTable.routes(
            List.of(
                new AppleContainers.Info("stopped", "stopped", "192.168.64.2", labels),
                new AppleContainers.Info("booting", "running", null, labels),
                new AppleContainers.Info("buildkit", "running", "192.168.64.3", Map.of())));

    assertThat(routes).isEmpty();
  }

  @Test
  @SuppressWarnings("unchecked")
  void traefikConfigHasRouterServiceHealthCheckAndRetry() {
    Map<String, Object> config =
        TraefikRoutes.config(
            List.of(
                new Route(
                    "shop", "shop.localhost", "/health", List.of("http://192.168.64.2:3000"))));

    Map<String, Object> http = (Map<String, Object>) config.get("http");
    Map<String, Object> router =
        (Map<String, Object>) ((Map<?, ?>) http.get("routers")).get("shop");
    Map<String, Object> lb =
        (Map<String, Object>)
            ((Map<?, ?>) ((Map<?, ?>) http.get("services")).get("shop")).get("loadBalancer");

    assertThat(router)
        .containsEntry("rule", "Host(`shop.localhost`)")
        .containsEntry("middlewares", List.of("shop-retry"));
    assertThat((Map<String, Object>) lb.get("healthCheck")).containsEntry("path", "/health");
    assertThat(lb.get("servers")).isEqualTo(List.of(Map.of("url", "http://192.168.64.2:3000")));
    assertThat(http.get("middlewares").toString()).contains("shop-retry");
  }

  @Test
  void noRunningAppsMeansAnEmptyConfig() {
    assertThat(TraefikRoutes.config(List.of())).isEmpty();
  }

  private static ContainerSpec spec(String route, String host, String healthPath) {
    return ContainerSpec.builder()
        .name("forge-" + route)
        .image("forge/" + route + ":abc")
        .port(3000)
        .route(route, host)
        .healthPath(healthPath)
        .deployment(UUID.randomUUID(), route)
        .build();
  }
}
