package com.forge.runtime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.forge.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

class RoutingIntegrationTest extends AbstractIntegrationTest {

  @Test
  void onlyTheProxyWithTheSharedTokenCanReadTheRoutingTable() throws Exception {
    mvc.perform(get("/internal/routing")).andExpect(status().isUnauthorized());
    mvc.perform(get("/internal/routing").header("X-Forge-Routing-Token", "wrong"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/internal/routing").header("X-Forge-Routing-Token", "test-routing-token"))
        .andExpect(status().isOk());
  }
}
