package com.forge.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base class for integration tests: the full Spring context against a real PostgreSQL (never H2, so
 * SQL like {@code FOR UPDATE SKIP LOCKED} and partial indexes is really exercised).
 *
 * <p>The database is {@code FORGE_TEST_DB_URL} when set (a local Postgres, e.g. on a Mac running
 * Apple containers instead of Docker); otherwise one Testcontainers Postgres shared by all test
 * classes (CI).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

  private static final String EXTERNAL_URL = System.getenv("FORGE_TEST_DB_URL");

  static final PostgreSQLContainer<?> POSTGRES =
      EXTERNAL_URL == null || EXTERNAL_URL.isBlank()
          ? new PostgreSQLContainer<>("postgres:16-alpine")
          : null;

  static {
    if (POSTGRES != null) {
      POSTGRES.start();
    }
  }

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    if (POSTGRES != null) {
      registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
      registry.add("spring.datasource.username", POSTGRES::getUsername);
      registry.add("spring.datasource.password", POSTGRES::getPassword);
    } else {
      registry.add("spring.datasource.url", () -> EXTERNAL_URL);
      registry.add("spring.datasource.username", () -> env("FORGE_TEST_DB_USER", "forge"));
      registry.add("spring.datasource.password", () -> env("FORGE_TEST_DB_PASSWORD", "forge"));
    }
  }

  private static String env(String name, String fallback) {
    String value = System.getenv(name);
    return value == null || value.isBlank() ? fallback : value;
  }

  @Autowired protected MockMvc mvc;
  @Autowired protected ObjectMapper json;
  @Autowired protected JdbcTemplate jdbc;

  @BeforeEach
  void cleanDatabase() {
    jdbc.execute(
        "truncate table deployment_insights, log_lines, runtime_instances, deployment_events,"
            + " jobs, webhook_deliveries, environment_variables, github_connections,"
            + " refresh_tokens cascade");
    jdbc.execute("update projects set live_deployment_id = null");
    jdbc.execute("delete from deployments");
    jdbc.execute("delete from projects");
    jdbc.execute("delete from users");
  }

  /** Registers a fresh user and returns a valid access token. */
  protected String signUp(String name) throws Exception {
    String email = name + "-" + UUID.randomUUID() + "@example.com";
    mvc.perform(
            MockMvcRequestBuilders.post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"%s","password":"correct-horse-battery","displayName":"%s"}
                    """
                        .formatted(email, name)))
        .andReturn();
    String body =
        mvc.perform(
                MockMvcRequestBuilders.post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"email":"%s","password":"correct-horse-battery"}
                        """
                            .formatted(email)))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(body).get("accessToken").asText();
  }

  protected JsonNode read(String body) throws Exception {
    return json.readTree(body);
  }

  protected static String bearer(String token) {
    return "Bearer " + token;
  }
}
