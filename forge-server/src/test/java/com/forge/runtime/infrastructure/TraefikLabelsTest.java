package com.forge.runtime.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.forge.runtime.ContainerSpec;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TraefikLabelsTest {

  @Test
  void routesTheSlugHostToTheAppPortWithHealthCheckAndRetries() {
    UUID deployment = UUID.randomUUID();
    ContainerSpec spec =
        ContainerSpec.builder()
            .name("forge-shop-1")
            .image("img")
            .port(3000)
            .route("shop", "shop.localhost")
            .healthPath("/health")
            .deployment(deployment, "shop")
            .build();

    Map<String, String> labels = TraefikLabels.forSpec(spec, "forge-apps");

    assertThat(labels)
        .containsEntry("traefik.enable", "true")
        .containsEntry("traefik.docker.network", "forge-apps")
        .containsEntry("traefik.http.routers.shop.rule", "Host(`shop.localhost`)")
        .containsEntry("traefik.http.services.shop.loadbalancer.server.port", "3000")
        .containsEntry("traefik.http.services.shop.loadbalancer.healthcheck.path", "/health")
        .containsEntry("traefik.http.routers.shop.middlewares", "shop-retry")
        .containsEntry("traefik.http.middlewares.shop-retry.retry.attempts", "5")
        .containsEntry("forge.deployment", deployment.toString());
  }

  @Test
  void containerSpecBuilderRequiresTheEssentials() {
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> ContainerSpec.builder().build())
        .isInstanceOf(NullPointerException.class);
  }
}
