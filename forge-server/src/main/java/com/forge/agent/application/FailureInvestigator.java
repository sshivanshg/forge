package com.forge.agent.application;

import com.forge.agent.domain.Diagnosis;
import com.forge.agent.domain.FailureContext;
import com.forge.agent.domain.Insight;
import com.forge.agent.infrastructure.InsightRepository;
import com.forge.deployment.DeploymentQueries;
import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentStatusChanged;
import com.forge.deployment.DeploymentView;
import com.forge.logs.LogLine;
import com.forge.logs.LogReader;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The Forge agent's failure investigator. It runs an observe → reason → report loop:
 *
 * <ol>
 *   <li><b>Observe</b>: when a deployment fails, gather the failure, the project settings and the
 *       last log lines (secrets redacted).
 *   <li><b>Reason</b>: ask the diagnosis engines in order (LLM, then rules) until one answers.
 *   <li><b>Report</b>: store the insight, write a summary into the deployment log, and leave the
 *       decision to the user. The agent recommends; it never changes a deployment by itself.
 * </ol>
 */
@Service
public class FailureInvestigator {

  private static final Logger log = LoggerFactory.getLogger(FailureInvestigator.class);

  private final List<DiagnosisEngine> engines;
  private final DeploymentQueries deployments;
  private final ProjectCatalog projects;
  private final LogReader logReader;
  private final LogSink logSink;
  private final InsightRepository insights;
  private final AgentProperties properties;
  private final Clock clock;

  public FailureInvestigator(
      List<DiagnosisEngine> engines,
      DeploymentQueries deployments,
      ProjectCatalog projects,
      LogReader logReader,
      LogSink logSink,
      InsightRepository insights,
      AgentProperties properties,
      Clock clock) {
    this.engines = engines;
    this.deployments = deployments;
    this.projects = projects;
    this.logReader = logReader;
    this.logSink = logSink;
    this.insights = insights;
    this.properties = properties;
    this.clock = clock;
  }

  @Async
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onDeploymentFailed(DeploymentStatusChanged event) {
    if (event.to() == DeploymentStatus.FAILED) {
      try {
        investigate(event.deploymentId());
      } catch (RuntimeException e) {
        log.error("Agent could not investigate deployment {}", event.deploymentId(), e);
      }
    }
  }

  public Insight investigate(UUID deploymentId) {
    Optional<Insight> existing = insights.findById(deploymentId);
    if (existing.isPresent()) {
      return existing.get(); // idempotent: one investigation per failed deployment
    }
    FailureContext context = observe(deploymentId);
    for (DiagnosisEngine engine : engines) {
      Optional<Diagnosis> diagnosis = engine.diagnose(context);
      if (diagnosis.isPresent()) {
        Insight insight =
            insights.save(
                new Insight(deploymentId, diagnosis.get(), engine.name(), clock.instant()));
        logSink.append(
            deploymentId,
            LogSource.SYSTEM,
            "🤖 Forge agent (" + engine.name() + "): " + diagnosis.get().summary());
        log.info("Agent diagnosed {} as {}", deploymentId, diagnosis.get().category());
        return insight;
      }
    }
    throw new IllegalStateException("No diagnosis engine produced an answer");
  }

  FailureContext observe(UUID deploymentId) {
    DeploymentView deployment = deployments.get(deploymentId);
    ProjectSnapshot project = projects.get(deployment.projectId());
    SecretRedactor redactor = new SecretRedactor(projects.environmentOf(project.id()).values());
    List<String> lines =
        logReader.tail(deploymentId, properties.logLines()).stream()
            .map(LogLine::line)
            .map(redactor::redact)
            .toList();
    return new FailureContext(
        deploymentId,
        project.name(),
        deployment.failureReason() == null ? "UNKNOWN" : deployment.failureReason().name(),
        redactor.redact(deployment.failureDetail() == null ? "" : deployment.failureDetail()),
        project.buildType().name(),
        project.port(),
        project.healthCheckPath(),
        deployment.commitSha(),
        deployment.commitMessage(),
        lines);
  }
}
