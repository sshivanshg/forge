package com.forge.agent.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.agent.domain.Diagnosis;
import com.forge.agent.domain.Diagnosis.Confidence;
import com.forge.agent.domain.FailureContext;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * LLM-backed diagnosis through the Anthropic Messages API. It only reasons over the redacted {@link
 * FailureContext} and must answer in a fixed JSON shape. Any error, timeout or malformed answer
 * returns empty, so the rule engine takes over: the LLM can improve answers but never break the
 * feature.
 */
@Component
@Order(1)
class ClaudeDiagnosisEngine implements DiagnosisEngine {

  private static final Logger log = LoggerFactory.getLogger(ClaudeDiagnosisEngine.class);

  private static final String SYSTEM_PROMPT =
      """
      You are the Forge deployment agent. A user's deployment failed on Forge, a platform that
      builds a Git repository into a Docker image, runs it, health-checks it over HTTP, and only
      then switches traffic to it. Diagnose the root cause from the facts and logs given.
      Reply with ONLY a JSON object, no prose, with exactly these keys:
        "category": short UPPER_SNAKE_CASE label (e.g. PORT_MISMATCH, COMPILATION_ERROR),
        "summary": one or two sentences explaining what went wrong, for a student developer,
        "suggestedFix": concrete steps the user should take,
        "confidence": "LOW", "MEDIUM" or "HIGH",
        "evidence": array of up to 5 log lines copied verbatim that support the diagnosis.
      Never invent log lines. If the logs are inconclusive, say so and use LOW confidence.
      """;

  private final AgentProperties properties;
  private final ObjectMapper objectMapper;
  private final RestClient http;

  ClaudeDiagnosisEngine(
      AgentProperties properties, ObjectMapper objectMapper, RestClient.Builder builder) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    var timeouts = new SimpleClientHttpRequestFactory();
    timeouts.setConnectTimeout(5_000);
    timeouts.setReadTimeout(60_000);
    this.http = builder.clone().requestFactory(timeouts).baseUrl(properties.apiBaseUrl()).build();
  }

  @Override
  public String name() {
    return properties.model();
  }

  @Override
  public Optional<Diagnosis> diagnose(FailureContext context) {
    if (!properties.llmEnabled()) {
      return Optional.empty();
    }
    try {
      JsonNode response =
          http.post()
              .uri("/v1/messages")
              .header("x-api-key", properties.anthropicApiKey())
              .header("anthropic-version", "2023-06-01")
              .body(
                  Map.of(
                      "model",
                      properties.model(),
                      "max_tokens",
                      1024,
                      "system",
                      SYSTEM_PROMPT,
                      "messages",
                      List.of(Map.of("role", "user", "content", describe(context)))))
              .retrieve()
              .body(JsonNode.class);
      return parse(response);
    } catch (RuntimeException e) {
      log.warn("LLM diagnosis unavailable, falling back to rules: {}", e.getMessage());
      return Optional.empty();
    }
  }

  static String describe(FailureContext c) {
    return """
        Project: %s
        Failure reason: %s
        Failure detail: %s
        Build type: %s
        Expected port: %d
        Health check path: %s
        Commit: %s %s

        Last log lines:
        %s
        """
        .formatted(
            c.projectName(),
            c.failureReason(),
            c.failureDetail(),
            c.buildType(),
            c.configuredPort(),
            c.healthCheckPath(),
            c.commitSha(),
            c.commitMessage() == null ? "" : c.commitMessage(),
            String.join("\n", c.logLines()));
  }

  private Optional<Diagnosis> parse(JsonNode response) throws RuntimeException {
    if (response == null) {
      return Optional.empty();
    }
    String text = response.path("content").path(0).path("text").asText("");
    int start = text.indexOf('{');
    int end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return Optional.empty();
    }
    try {
      JsonNode json = objectMapper.readTree(text.substring(start, end + 1));
      List<String> evidence =
          json.path("evidence").isArray()
              ? objectMapper.convertValue(
                  json.path("evidence"),
                  objectMapper.getTypeFactory().constructCollectionType(List.class, String.class))
              : List.of();
      return Optional.of(
          new Diagnosis(
              json.path("category").asText("UNKNOWN"),
              json.path("summary").asText(),
              json.path("suggestedFix").asText(),
              Confidence.valueOf(json.path("confidence").asText("LOW").toUpperCase()),
              evidence));
    } catch (Exception malformed) {
      log.warn("LLM answer was not valid JSON; falling back to rules");
      return Optional.empty();
    }
  }
}
