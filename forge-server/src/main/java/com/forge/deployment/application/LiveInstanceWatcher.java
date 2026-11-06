package com.forge.deployment.application;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.domain.Deployment;
import com.forge.deployment.domain.RuntimeInstanceRecord;
import com.forge.deployment.infrastructure.DeploymentRepository;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.runtime.RuntimeProvider;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Self-healing: every 30 s, checks that each LIVE deployment's containers (one per replica) are
 * still running. If one is gone (the app crashed, the host rebooted, someone deleted it), Forge
 * queues a RECOVERY deployment of the same image, which goes through the normal blue-green rollout
 * and health check while the remaining replicas keep serving.
 *
 * <p>Each live deployment is recovered at most once, so an image that can no longer start does not
 * loop forever; the failed RECOVERY deployment and its agent diagnosis show what went wrong.
 */
@Component
public class LiveInstanceWatcher {

  private static final Logger log = LoggerFactory.getLogger(LiveInstanceWatcher.class);
  private static final List<DeploymentStatus> BUSY =
      List.of(
          DeploymentStatus.QUEUED,
          DeploymentStatus.BUILDING,
          DeploymentStatus.DEPLOYING,
          DeploymentStatus.HEALTH_CHECKING,
          DeploymentStatus.CANARY);

  private final DeploymentRepository deployments;
  private final DeploymentTransitions transitions;
  private final RuntimeProvider runtime;
  private final LogSink logs;
  private final DeploymentProperties properties;

  public LiveInstanceWatcher(
      DeploymentRepository deployments,
      DeploymentTransitions transitions,
      RuntimeProvider runtime,
      LogSink logs,
      DeploymentProperties properties) {
    this.deployments = deployments;
    this.transitions = transitions;
    this.runtime = runtime;
    this.logs = logs;
    this.properties = properties;
  }

  @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
  void scheduledCheck() {
    if (properties.selfHeal()) {
      checkLiveInstances();
    }
  }

  /** Returns how many recoveries were queued. */
  public int checkLiveInstances() {
    int recovered = 0;
    for (Deployment live : deployments.findLive()) {
      try {
        if (needsRecovery(live)) {
          Deployment recovery = transitions.queueRecovery(live.id());
          logs.append(
              recovery.id(),
              LogSource.SYSTEM,
              "▶ The live container of "
                  + live.id().toString().substring(0, 8)
                  + " is gone; starting the same image again");
          log.warn(
              "Live deployment {} lost its container; queued recovery {}",
              live.id(),
              recovery.id());
          recovered++;
        }
      } catch (RuntimeException e) {
        // The engine may be briefly unreachable: never recover on a guess, try again next round
        log.warn("Could not check live deployment {}: {}", live.id(), e.getMessage());
      }
    }
    return recovered;
  }

  private boolean needsRecovery(Deployment live) {
    if (!deployments.findByProjectAndStatusIn(live.projectId(), BUSY).isEmpty()
        || deployments.recoveryAttempted(live.id())) {
      return false; // a newer deployment will replace it anyway, or we already tried
    }
    List<RuntimeInstanceRecord> instances = transitions.instancesOf(live.id());
    // One lost replica is enough: the recovery rolls out a full set while the others keep serving
    return instances.stream().anyMatch(instance -> !runtime.isRunning(instance.externalId()));
  }
}
