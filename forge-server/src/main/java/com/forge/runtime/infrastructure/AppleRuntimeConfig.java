package com.forge.runtime.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.runtime.RuntimeProvider;
import com.forge.runtime.application.RoutingTable;
import com.forge.shared.container.ContainerCli;
import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the Apple container runtime and its routing table (the default engine). */
@Configuration
@ConditionalOnProperty(name = "forge.engine", havingValue = "apple", matchIfMissing = true)
class AppleRuntimeConfig {

  @Bean
  AppleContainers appleContainers(ContainerCli cli, ObjectMapper json) {
    return new AppleContainers(cli, json);
  }

  @Bean
  RoutingTable routingTable(AppleContainers containers, Clock clock) {
    return new AppleRoutingTable(containers, clock);
  }

  @Bean
  RuntimeProvider appleRuntimeProvider(
      ContainerCli cli,
      AppleContainers containers,
      RoutingTable routing,
      RuntimeProperties properties) {
    return new AppleContainerRuntimeProvider(cli, containers, routing, properties);
  }
}
