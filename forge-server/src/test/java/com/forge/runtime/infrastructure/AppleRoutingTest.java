package com.forge.runtime.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.runtime.ContainerSpec;
import com.forge.runtime.infrastructure.AppleRoutingTable.Split;
import com.forge.runtime.infrastructure.TraefikRoutes.Route;
import com.forge.runtime.infrastructure.TraefikRoutes.Version;
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
  void blueAndGreenOfOneProjectShareARouteAsTwoEquallyWeightedVersions() {
    Map<String, String> blue =
        AppleContainerRuntimeProvider.labels(spec("shop", "shop.localhost", "/health"));
    Map<String, String> green =
        AppleContainerRuntimeProvider.labels(spec("shop", "shop.localhost", "/health"));

    List<Route> routes =
        AppleRoutingTable.routes(
            List.of(
                new AppleContainers.Info("blue", "running", "192.168.64.2", blue),
                new AppleContainers.Info("green", "running", "192.168.64.3", green)));

    assertThat(routes).hasSize(1);
    assertThat(routes.getFirst().host()).isEqualTo("shop.localhost");
    assertThat(routes.getFirst().healthPath()).isEqualTo("/health");
    assertThat(routes.getFirst().servers())
        .containsExactlyInAnyOrder("http://192.168.64.2:3000", "http://192.168.64.3:3000");
    assertThat(routes.getFirst().versions()).hasSize(2).allMatch(v -> v.weight() == 1);
  }

  @Test
  void replicasOfOneDeploymentAreOneVersionWithSeveralServers() {
    Map<String, String> labels = AppleContainerRuntimeProvider.labels(spec("shop", "s", "/"));

    List<Route> routes =
        AppleRoutingTable.routes(
            List.of(
                new AppleContainers.Info("r1", "running", "192.168.64.2", labels),
                new AppleContainers.Info("r2", "running", "192.168.64.3", labels)));

    assertThat(routes.getFirst().versions())
        .singleElement()
        .satisfies(v -> assertThat(v.servers()).hasSize(2));
  }

  @Test
  void aCanarySplitWeightsTheVersions() {
    ContainerSpec liveSpec = spec("shop", "s", "/");
    ContainerSpec canarySpec = spec("shop", "s", "/");
    String canary = canarySpec.deploymentId().toString();
    List<AppleContainers.Info> running =
        List.of(
            new AppleContainers.Info(
                "live", "running", "192.168.64.2", AppleContainerRuntimeProvider.labels(liveSpec)),
            new AppleContainers.Info(
                "new",
                "running",
                "192.168.64.3",
                AppleContainerRuntimeProvider.labels(canarySpec)));

    List<Version> at20 =
        AppleRoutingTable.routes(running, Map.of("shop", new Split(canary, 20)))
            .getFirst()
            .versions();
    List<Version> held =
        AppleRoutingTable.routes(running, Map.of("shop", new Split(canary, 0)))
            .getFirst()
            .versions();

    assertThat(at20)
        .extracting(Version::deploymentId, Version::weight)
        .containsExactlyInAnyOrder(
            tuple(canary, 20), tuple(liveSpec.deploymentId().toString(), 80));
    assertThat(held)
        .filteredOn(v -> v.deploymentId().equals(canary))
        .singleElement()
        .satisfies(v -> assertThat(v.weight()).isZero());
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
  void traefikConfigHasRouterWeightedServiceHealthCheckAndRetry() {
    String live = "aaaaaaaa-0000-0000-0000-000000000000";
    String canary = "bbbbbbbb-0000-0000-0000-000000000000";
    Map<String, Object> config =
        TraefikRoutes.config(
            List.of(
                new Route(
                    "shop",
                    "shop.localhost",
                    "/health",
                    List.of(
                        new Version(live, List.of("http://192.168.64.2:3000"), 80),
                        new Version(canary, List.of("http://192.168.64.3:3000"), 0)))));

    Map<String, Object> http = (Map<String, Object>) config.get("http");
    Map<String, Object> services = (Map<String, Object>) http.get("services");
    Map<String, Object> router =
        (Map<String, Object>) ((Map<?, ?>) http.get("routers")).get("shop");
    Map<String, Object> weighted =
        (Map<String, Object>) ((Map<?, ?>) services.get("shop")).get("weighted");
    Map<String, Object> liveLb =
        (Map<String, Object>) ((Map<?, ?>) services.get("shop-aaaaaaaa")).get("loadBalancer");

    assertThat(router)
        .containsEntry("rule", "Host(`shop.localhost`)")
        .containsEntry("service", "shop")
        .containsEntry("middlewares", List.of("shop-retry"));
    // a version at weight 0 gets no traffic at all
    assertThat(weighted.get("services"))
        .isEqualTo(List.of(Map.of("name", "shop-aaaaaaaa", "weight", 80)));
    assertThat(weighted).containsKey("healthCheck");
    assertThat((Map<String, Object>) liveLb.get("healthCheck")).containsEntry("path", "/health");
    assertThat(liveLb.get("servers")).isEqualTo(List.of(Map.of("url", "http://192.168.64.2:3000")));
    assertThat(services).containsKey("shop-bbbbbbbb");
    assertThat(http.get("middlewares").toString()).contains("shop-retry");
  }

  @Test
  void traefikMetricsAreSummedPerVersionAndCount5xxAsErrors() {
    String text =
        """
        # HELP traefik_service_requests_total How many HTTP requests processed on a service.
        traefik_service_requests_total{code="200",method="GET",protocol="http",service="shop-aaaaaaaa@http"} 90
        traefik_service_requests_total{code="503",method="GET",protocol="http",service="shop-aaaaaaaa@http"} 10
        traefik_service_requests_total{code="200",method="GET",protocol="http",service="shop-api-aaaaaaaa@http"} 999
        traefik_service_request_duration_seconds_sum{code="200",method="GET",protocol="http",service="shop-aaaaaaaa@http"} 1.5
        traefik_service_request_duration_seconds_sum{code="503",method="GET",protocol="http",service="shop-aaaaaaaa@http"} 0.5
        traefik_service_request_duration_seconds_count{code="200",method="GET",protocol="http",service="shop-aaaaaaaa@http"} 90
        """;

    var sample = TraefikMetrics.parse(text, "shop-aaaaaaaa@http");

    assertThat(sample.requests()).isEqualTo(100);
    assertThat(sample.serverErrors()).isEqualTo(10);
    assertThat(sample.errorRate()).isEqualTo(0.1);
    assertThat(sample.meanLatencyMillis()).isEqualTo(20.0);
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
