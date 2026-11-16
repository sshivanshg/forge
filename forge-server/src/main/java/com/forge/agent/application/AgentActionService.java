package com.forge.agent.application;

import com.forge.agent.domain.ActionPlan;
import com.forge.agent.domain.ActionSource;
import com.forge.agent.domain.ActionStatus;
import com.forge.agent.domain.AgentAction;
import com.forge.agent.infrastructure.AgentActionRepository;
import com.forge.deployment.DeploymentQueries;
import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentStatusChanged;
import com.forge.deployment.DeploymentView;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.project.ProjectCatalog;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.shared.error.NotFoundException;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The human-in-the-loop gate between the agent and the platform. The agent may only {@link
 * #propose}; executing needs {@link #approve} by the project owner.
 *
 * <p>Approval runs in three steps so a slow or failing action never leaves a proposal stuck:
 *
 * <ol>
 *   <li>claim: PROPOSED → APPROVED is committed first; a concurrent second approval fails its
 *       optimistic-lock check and gets 409;
 *   <li>execute outside any transaction (a deploy request resolves the branch over the network);
 *   <li>record EXECUTED or FAILED in a new transaction.
 * </ol>
 */
@Service
public class AgentActionService {

  private static final Logger log = LoggerFactory.getLogger(AgentActionService.class);

  private final AgentActionRepository actions;
  private final ProjectCatalog projects;
  private final DeploymentQueries deployments;
  private final ActionExecutor executor;
  private final LogSink logSink;
  private final TransactionTemplate tx;
  private final Clock clock;

  public AgentActionService(
      AgentActionRepository actions,
      ProjectCatalog projects,
      DeploymentQueries deployments,
      ActionExecutor executor,
      LogSink logSink,
      PlatformTransactionManager transactions,
      Clock clock) {
    this.actions = actions;
    this.projects = projects;
    this.deployments = deployments;
    this.executor = executor;
    this.logSink = logSink;
    this.tx = new TransactionTemplate(transactions);
    this.clock = clock;
  }

  /**
   * Stores a proposal unless one of the same type is already open for the project (the agent never
   * stacks duplicates; a unique partial index enforces it even under races).
   */
  public Optional<AgentAction> propose(
      UUID projectId, UUID deploymentId, ActionSource source, ActionPlan plan) {
    try {
      return tx.execute(
          status -> {
            if (actions
                .findFirstByProjectIdAndTypeAndStatus(projectId, plan.type(), ActionStatus.PROPOSED)
                .isPresent()) {
              return Optional.<AgentAction>empty();
            }
            AgentAction action =
                actions.save(
                    AgentAction.propose(projectId, deploymentId, source, plan, clock.instant()));
            if (deploymentId != null) {
              logSink.append(
                  deploymentId, LogSource.SYSTEM, "🤖 Forge agent proposes: " + plan.title());
            }
            log.info("Agent proposed {} for project {}: {}", plan.type(), projectId, plan.title());
            return Optional.of(action);
          });
    } catch (DataIntegrityViolationException duplicate) {
      return Optional.empty(); // another thread proposed the same type first
    }
  }

  public List<AgentAction> listForProject(UUID projectId, UUID userId) {
    projects.getOwned(projectId, userId);
    return actions.findByProjectIdOrderByCreatedAtDesc(projectId);
  }

  public List<AgentAction> listForDeployment(UUID deploymentId, UUID userId) {
    deployments.getOwned(deploymentId, userId);
    return actions.findByDeploymentIdOrderByCreatedAtDesc(deploymentId);
  }

  public AgentAction approve(UUID actionId, UUID userId) {
    AgentAction claimed =
        tx.execute(
            status -> {
              AgentAction action = loadOwned(actionId, userId);
              decide(() -> action.approve(userId, clock.instant()));
              return actions.saveAndFlush(action);
            });
    String outcome;
    UUID resultDeployment = null;
    boolean ok;
    try {
      DeploymentView started = executor.execute(claimed, userId);
      resultDeployment = started.id();
      outcome = "Started deployment " + started.id();
      ok = true;
    } catch (RuntimeException e) {
      outcome = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
      ok = false;
      log.warn("Approved agent action {} failed: {}", actionId, outcome);
    }
    final String message = outcome;
    final UUID result = resultDeployment;
    final boolean succeeded = ok;
    return tx.execute(
        status -> {
          AgentAction action = actions.findById(actionId).orElseThrow();
          if (succeeded) {
            action.executed(result, message, clock.instant());
          } else {
            action.failed(message, clock.instant());
          }
          return actions.save(action);
        });
  }

  public AgentAction reject(UUID actionId, UUID userId) {
    return tx.execute(
        status -> {
          AgentAction action = loadOwned(actionId, userId);
          decide(() -> action.rejected(userId, clock.instant()));
          return actions.save(action);
        });
  }

  /**
   * A new version went live: proposals made for earlier deployments of that project are stale (the
   * problem they addressed is gone or was fixed another way), so they expire.
   */
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onDeploymentLive(DeploymentStatusChanged event) {
    if (event.to() != DeploymentStatus.LIVE) {
      return;
    }
    tx.executeWithoutResult(
        status ->
            actions.findByProjectIdAndStatus(event.projectId(), ActionStatus.PROPOSED).stream()
                .filter(a -> !event.deploymentId().equals(a.deploymentId()))
                .forEach(
                    a -> {
                      a.expired("A newer deployment went live", clock.instant());
                      actions.save(a);
                    }));
  }

  private AgentAction loadOwned(UUID actionId, UUID userId) {
    AgentAction action =
        actions
            .findById(actionId)
            .orElseThrow(() -> new NotFoundException("AgentAction", actionId));
    projects.getOwned(action.projectId(), userId); // 404 for anyone but the owner
    return action;
  }

  private static void decide(Runnable transition) {
    try {
      transition.run();
    } catch (IllegalStateException e) {
      throw new ForgeException(ErrorCode.ACTION_ALREADY_DECIDED, e.getMessage());
    }
  }
}
