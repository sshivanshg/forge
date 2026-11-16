package com.forge.agent.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.agent.domain.Diagnosis;
import com.forge.agent.domain.Diagnosis.Confidence;
import com.forge.agent.domain.FailureContext;
import com.forge.deployment.DeploymentQueries;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * LLM-backed investigation through the Anthropic Messages API with tool use. The model starts from
 * the redacted {@link FailureContext}, may call Forge's own tools ({@link AgentToolbox}: logs,
 * deployment history, traffic, commit diffs) to dig further, may propose fixes (rollback, redeploy,
 * settings change) that the owner must approve, and finishes by calling {@code submit_diagnosis}.
 *
 * <p>The loop is bounded by {@code forge.agent.max-tool-calls}. Any error, timeout or a run that
 * never submits returns empty, so the rule engine takes over: the LLM can improve answers but never
 * break the feature.
 */
@Component
@Order(1)
class ClaudeDiagnosisEngine implements DiagnosisEngine {

  private static final Logger log = LoggerFactory.getLogger(ClaudeDiagnosisEngine.class);

  private static final String SYSTEM_PROMPT =
      """
      You are the Forge deployment agent. A user's deployment failed on Forge, a platform that
      builds a Git repository into a container image, runs it, health-checks it over HTTP, and
      only then switches traffic to it. The previous live version keeps serving.
      Investigate the root cause. You may call tools to read more logs, list deployments, compare
      the failed commit with the last good one, and read traffic numbers.
      If a change Forge can make would fix it (a settings change such as the port, health path,
      root folder or build type; a redeploy of a transient failure; a rollback), propose it with a
      propose_* tool. Proposals are only suggestions: the owner approves or rejects them. Do not
      propose code changes as actions; describe those in suggested_fix instead.
      Finish by calling submit_diagnosis exactly once. Never invent log lines; if the evidence is
      inconclusive, say so and use LOW confidence.
      """;

  private final AgentProperties properties;
  private final ObjectMapper objectMapper;
  private final AgentToolbox toolbox;
  private final DeploymentQueries deployments;
  private final RestClient http;

  ClaudeDiagnosisEngine(
      AgentProperties properties,
      ObjectMapper objectMapper,
      AgentToolbox toolbox,
      DeploymentQueries deployments,
      RestClient.Builder builder) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.toolbox = toolbox;
    this.deployments = deployments;
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
      UUID projectId = deployments.get(context.deploymentId()).projectId();
      AgentToolbox.Session session =
          toolbox.open(context.deploymentId(), projectId, context.commitSha());
      List<Map<String, Object>> messages = new ArrayList<>();
      messages.add(Map.of("role", "user", "content", describe(context)));
      for (int turn = 0; turn <= properties.maxToolCalls(); turn++) {
        boolean last = turn == properties.maxToolCalls();
        JsonNode response = send(messages, last);
        if (response == null) {
          return Optional.empty();
        }
        JsonNode content = response.path("content");
        messages.add(
            Map.of("role", "assistant", "content", objectMapper.convertValue(content, List.class)));
        List<Map<String, Object>> results = new ArrayList<>();
        for (JsonNode block : content) {
          if (!"tool_use".equals(block.path("type").asText())) {
            continue;
          }
          String name = block.path("name").asText();
          if (AgentToolbox.SUBMIT.equals(name)) {
            return Optional.of(toDiagnosis(block.path("input")).withProposals(session.proposals()));
          }
          log.debug("Agent tool call {} for {}", name, context.deploymentId());
          results.add(
              Map.of(
                  "type", "tool_result",
                  "tool_use_id", block.path("id").asText(),
                  "content", toolbox.call(session, name, block.path("input"))));
        }
        if (results.isEmpty()) {
          return Optional.empty(); // the model stopped without submitting
        }
        messages.add(Map.of("role", "user", "content", results));
      }
      return Optional.empty();
    } catch (RuntimeException e) {
      log.warn("LLM diagnosis unavailable, falling back to rules: {}", e.getMessage());
      return Optional.empty();
    }
  }

  /** On the last turn the model must submit, so the loop always ends with an answer or empty. */
  private JsonNode send(List<Map<String, Object>> messages, boolean mustSubmit) {
    return http.post()
        .uri("/v1/messages")
        .header("x-api-key", properties.anthropicApiKey())
        .header("anthropic-version", "2023-06-01")
        .body(
            Map.of(
                "model",
                properties.model(),
                "max_tokens",
                2048,
                "system",
                SYSTEM_PROMPT,
                "tools",
                AgentToolbox.definitions(),
                "tool_choice",
                mustSubmit
                    ? Map.of("type", "tool", "name", AgentToolbox.SUBMIT)
                    : Map.of("type", "auto"),
                "messages",
                messages))
        .retrieve()
        .body(JsonNode.class);
  }

  private Diagnosis toDiagnosis(JsonNode input) {
    List<String> evidence = new ArrayList<>();
    input.path("evidence").forEach(line -> evidence.add(line.asText()));
    Confidence confidence;
    try {
      confidence = Confidence.valueOf(input.path("confidence").asText("LOW").toUpperCase());
    } catch (IllegalArgumentException e) {
      confidence = Confidence.LOW;
    }
    return new Diagnosis(
        input.path("category").asText("UNKNOWN"),
        input.path("summary").asText(),
        input.path("suggested_fix").asText(),
        confidence,
        evidence);
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
}
