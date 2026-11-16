package com.forge.agent.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.forge.agent.domain.ActionPlan;
import com.forge.agent.domain.SettingsPatch;
import com.forge.build.BuildType;
import com.forge.deployment.DeploymentCommands;
import com.forge.deployment.DeploymentView;
import com.forge.logs.LogLine;
import com.forge.logs.LogReader;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.runtime.TrafficMetrics;
import com.forge.source.CommitDiff;
import com.forge.source.GitHubAccounts;
import com.forge.source.GitRepository;
import com.forge.source.SourceCodeProvider;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * The tools the LLM agent may call. Read tools return data about the failing project only (logs,
 * deployment history, traffic, commit diffs), always redacted. Action tools never act: they record
 * an {@link ActionPlan} that becomes a proposal the owner must approve.
 */
@Component
class AgentToolbox {

  static final String SUBMIT = "submit_diagnosis";
  private static final int MAX_DIFF_CHARS = 6_000;

  private final LogReader logs;
  private final DeploymentCommands deployments;
  private final ProjectCatalog projects;
  private final SourceCodeProvider source;
  private final GitHubAccounts gitHub;
  private final ObjectProvider<TrafficMetrics> metrics;

  AgentToolbox(
      LogReader logs,
      DeploymentCommands deployments,
      ProjectCatalog projects,
      SourceCodeProvider source,
      GitHubAccounts gitHub,
      ObjectProvider<TrafficMetrics> metrics) {
    this.logs = logs;
    this.deployments = deployments;
    this.projects = projects;
    this.source = source;
    this.gitHub = gitHub;
    this.metrics = metrics;
  }

  /** One investigation: the project it may look at, its redactor, and the plans it proposed. */
  Session open(UUID deploymentId, UUID projectId, String failedCommitSha) {
    ProjectSnapshot project = projects.get(projectId);
    return new Session(
        deploymentId,
        project,
        failedCommitSha,
        new SecretRedactor(projects.environmentOf(projectId).values()));
  }

  /** JSON schemas of the tools, in the Messages API format. */
  static List<Map<String, Object>> definitions() {
    return List.of(
        tool(
            "read_logs",
            "Read more of the failed deployment's build and runtime log (secrets redacted).",
            Map.of("lines", prop("integer", "How many of the last lines, up to 400")),
            List.of()),
        tool(
            "list_deployments",
            "List the project's 10 newest deployments with status, commit and whether an image exists (needed for a rollback target).",
            Map.of(),
            List.of()),
        tool(
            "get_traffic",
            "Requests, 5xx errors and mean latency the proxy measured for one deployment since it went live.",
            Map.of("deployment_id", prop("string", "Deployment id")),
            List.of("deployment_id")),
        tool(
            "get_commit_diff",
            "Unified diff between two commits of the project's branch, to find what changed since the last good deployment.",
            Map.of(
                "base_sha",
                prop("string", "Older commit"),
                "head_sha",
                prop("string", "Newer commit")),
            List.of("base_sha", "head_sha")),
        tool(
            "propose_rollback",
            "Propose rolling back to an earlier deployment that has an image. Only a proposal: the owner must approve it.",
            Map.of(
                "target_deployment_id",
                prop("string", "Deployment to roll back to"),
                "reason",
                prop("string", "Why, for the owner")),
            List.of("target_deployment_id", "reason")),
        tool(
            "propose_redeploy",
            "Propose deploying a commit again (e.g. a transient failure). Only a proposal.",
            Map.of(
                "commit_sha",
                prop("string", "Commit, or omit for the branch head"),
                "reason",
                prop("string", "Why, for the owner")),
            List.of("reason")),
        tool(
            "propose_settings_change",
            "Propose changing build or run settings and redeploying the failed commit. Only a proposal. Set only the fields to change.",
            Map.of(
                "root_dir", prop("string", "Folder to build, relative to the repository root"),
                "build_type",
                    Map.of(
                        "type", "string", "enum", List.of("DOCKERFILE", "MAVEN", "GRADLE", "NODE")),
                "port", prop("integer", "Port the app listens on"),
                "health_check_path",
                    prop("string", "Path that returns 2xx when the app is healthy"),
                "replicas", prop("integer", "1 to 3"),
                "reason", prop("string", "Why, for the owner")),
            List.of("reason")),
        tool(
            SUBMIT,
            "Finish the investigation with your diagnosis. Call this exactly once, last.",
            Map.of(
                "category", prop("string", "UPPER_SNAKE_CASE label, e.g. PORT_MISMATCH"),
                "summary", prop("string", "One or two sentences for a student developer"),
                "suggested_fix", prop("string", "Concrete steps"),
                "confidence", Map.of("type", "string", "enum", List.of("LOW", "MEDIUM", "HIGH")),
                "evidence",
                    Map.of(
                        "type",
                        "array",
                        "items",
                        Map.of("type", "string"),
                        "description",
                        "Up to 5 log lines copied verbatim")),
            List.of("category", "summary", "suggested_fix", "confidence")));
  }

  /** Runs one read or action tool; the answer is text for the model. Errors are answers too. */
  String call(Session session, String name, JsonNode input) {
    try {
      return switch (name) {
        case "read_logs" ->
            readLogs(session, Math.min(Math.max(input.path("lines").asInt(150), 1), 400));
        case "list_deployments" -> listDeployments(session);
        case "get_traffic" ->
            traffic(session, UUID.fromString(input.path("deployment_id").asText()));
        case "get_commit_diff" ->
            diff(session, input.path("base_sha").asText(), input.path("head_sha").asText());
        case "propose_rollback" -> proposeRollback(session, input);
        case "propose_redeploy" ->
            session.record(
                ActionPlan.redeploy(
                    blankToNull(input.path("commit_sha").asText(null)),
                    "Redeploy",
                    input.path("reason").asText()));
        case "propose_settings_change" -> proposeSettings(session, input);
        default -> "Unknown tool " + name;
      };
    } catch (RuntimeException e) {
      return "Error: " + e.getMessage();
    }
  }

  private String readLogs(Session s, int lines) {
    return String.join(
        "\n",
        logs.tail(s.deploymentId(), lines).stream()
            .map(LogLine::line)
            .map(s.redactor()::redact)
            .toList());
  }

  private String listDeployments(Session s) {
    StringBuilder out = new StringBuilder();
    for (DeploymentView d : deployments.recent(s.project().id(), 10)) {
      out.append(d.id())
          .append(' ')
          .append(d.status())
          .append(" commit=")
          .append(
              d.commitSha() == null
                  ? "?"
                  : d.commitSha().substring(0, Math.min(12, d.commitSha().length())))
          .append(" full_sha=")
          .append(d.commitSha())
          .append(" trigger=")
          .append(d.trigger())
          .append(" image=")
          .append(d.imageRef() != null)
          .append(d.failureReason() == null ? "" : " failure=" + d.failureReason())
          .append(d.id().equals(s.project().liveDeploymentId()) ? " (currently live)" : "")
          .append('\n');
    }
    return out.isEmpty() ? "No deployments" : out.toString();
  }

  private String traffic(Session s, UUID deploymentId) {
    TrafficMetrics m = metrics.getIfAvailable();
    if (m == null) {
      return "Traffic metrics are not available on this engine";
    }
    return m.sample(s.project().slug(), deploymentId)
        .map(
            t ->
                "requests=%d server_errors=%d error_rate=%.3f mean_latency_ms=%.1f"
                    .formatted(
                        t.requests(), t.serverErrors(), t.errorRate(), t.meanLatencyMillis()))
        .orElse("No traffic recorded for that deployment");
  }

  private String diff(Session s, String base, String head) {
    CommitDiff d =
        source.compare(
            new GitRepository(s.project().repoOwner(), s.project().repoName()),
            s.project().branch(),
            base,
            head,
            gitHub.accessTokenFor(s.project().ownerId()),
            MAX_DIFF_CHARS);
    return "Changed files: "
        + String.join(", ", d.changedFiles())
        + "\n\n"
        + s.redactor().redact(d.patch())
        + (d.truncated() ? "\n[diff truncated]" : "");
  }

  private String proposeRollback(Session s, JsonNode input) {
    UUID target = UUID.fromString(input.path("target_deployment_id").asText());
    DeploymentView view =
        deployments.recent(s.project().id(), 50).stream()
            .filter(d -> d.id().equals(target))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Not a deployment of this project"));
    if (view.imageRef() == null) {
      throw new IllegalArgumentException("That deployment has no image to roll back to");
    }
    return s.record(
        ActionPlan.rollback(
            target, "Roll back to " + shortSha(view.commitSha()), input.path("reason").asText()));
  }

  private String proposeSettings(Session s, JsonNode input) {
    String buildType = blankToNull(input.path("build_type").asText(null));
    SettingsPatch patch =
        new SettingsPatch(
            blankToNull(input.path("root_dir").asText(null)),
            buildType == null ? null : BuildType.valueOf(buildType),
            input.hasNonNull("port") ? input.path("port").asInt() : null,
            blankToNull(input.path("health_check_path").asText(null)),
            input.hasNonNull("replicas") ? input.path("replicas").asInt() : null);
    return s.record(
        ActionPlan.updateSettings(
            patch,
            s.failedCommitSha(),
            "Change settings and redeploy",
            input.path("reason").asText()));
  }

  private static String shortSha(String sha) {
    return sha == null ? "an earlier version" : sha.substring(0, Math.min(7, sha.length()));
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s;
  }

  private static Map<String, Object> prop(String type, String description) {
    return Map.of("type", type, "description", description);
  }

  private static Map<String, Object> tool(
      String name, String description, Map<String, Object> properties, List<String> required) {
    Map<String, Object> schema = new LinkedHashMap<>();
    schema.put("type", "object");
    schema.put("properties", properties);
    schema.put("required", required);
    if (!SUBMIT.equals(name)) {
      return Map.of("name", name, "description", description, "input_schema", schema);
    }
    // The diagnosis is parsed field by field, so its shape is enforced by the API.
    schema.put("additionalProperties", false);
    return Map.of("name", name, "description", description, "input_schema", schema, "strict", true);
  }

  /** State of one investigation. Not shared between threads. */
  static final class Session {
    private final UUID deploymentId;
    private final ProjectSnapshot project;
    private final String failedCommitSha;
    private final SecretRedactor redactor;
    private final List<ActionPlan> proposals = new ArrayList<>();

    Session(
        UUID deploymentId,
        ProjectSnapshot project,
        String failedCommitSha,
        SecretRedactor redactor) {
      this.deploymentId = deploymentId;
      this.project = project;
      this.failedCommitSha = failedCommitSha;
      this.redactor = redactor;
    }

    UUID deploymentId() {
      return deploymentId;
    }

    ProjectSnapshot project() {
      return project;
    }

    String failedCommitSha() {
      return failedCommitSha;
    }

    SecretRedactor redactor() {
      return redactor;
    }

    List<ActionPlan> proposals() {
      return List.copyOf(proposals);
    }

    String record(ActionPlan plan) {
      proposals.add(plan);
      return "Recorded as a proposal for the owner to approve: " + plan.title();
    }
  }
}
