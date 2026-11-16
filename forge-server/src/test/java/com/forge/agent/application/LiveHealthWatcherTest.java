package com.forge.agent.application;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.forge.agent.domain.ActionPlan;
import com.forge.agent.domain.ActionSource;
import com.forge.build.BuildType;
import com.forge.deployment.DeploymentCommands;
import com.forge.deployment.DeploymentQueries;
import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentTrigger;
import com.forge.deployment.DeploymentView;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.project.RolloutMode;
import com.forge.runtime.TrafficMetrics;
import com.forge.runtime.TrafficSample;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class LiveHealthWatcherTest {

  private final UUID projectId = UUID.randomUUID();
  private final UUID liveId = UUID.randomUUID();
  private final UUID previousId = UUID.randomUUID();

  private final ProjectCatalog projects = mock(ProjectCatalog.class);
  private final DeploymentQueries queries = mock(DeploymentQueries.class);
  private final DeploymentCommands deployments = mock(DeploymentCommands.class);
  private final AgentActionService actions = mock(AgentActionService.class);
  private final TrafficMetrics traffic = mock(TrafficMetrics.class);
  private final List<DeploymentView> history = new ArrayList<>();
  private LiveHealthWatcher watcher;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    ObjectProvider<TrafficMetrics> provider = mock(ObjectProvider.class);
    when(provider.getIfAvailable()).thenReturn(traffic);
    ProjectSnapshot project =
        new ProjectSnapshot(
            projectId,
            UUID.randomUUID(),
            "App",
            "app",
            "o",
            "r",
            "main",
            ".",
            BuildType.NODE,
            8080,
            "/health",
            true,
            1,
            RolloutMode.BLUE_GREEN,
            liveId);
    when(projects.listLive()).thenReturn(List.of(project));
    DeploymentView live = view(liveId, DeploymentStatus.LIVE, "img:2");
    when(queries.get(liveId)).thenReturn(live);
    history.add(live);
    history.add(view(previousId, DeploymentStatus.SUPERSEDED, "img:1"));
    when(deployments.recent(projectId, 20)).thenReturn(history);
    // First sample sets the starting point; the second shows 40% 5xx over 40 requests.
    when(traffic.sample("app", liveId))
        .thenReturn(
            Optional.of(new TrafficSample(0, 0, 0)), Optional.of(new TrafficSample(40, 16, 2)));
    watcher =
        new LiveHealthWatcher(
            projects,
            queries,
            deployments,
            actions,
            provider,
            new AgentProperties(null, "m", "http://x", 150, true, true, 8));
  }

  @Test
  void proposesRollbackWhenTheLiveVersionFails() {
    watcher.scheduledCheck();
    watcher.scheduledCheck();

    verify(actions)
        .propose(eq(projectId), eq(liveId), eq(ActionSource.HEALTH_WATCH), any(ActionPlan.class));
  }

  @Test
  void staysQuietWhileADeploymentIsAlreadyRollingOut() {
    // e.g. the owner approved the rollback a moment ago and it is being health-checked
    history.addFirst(view(UUID.randomUUID(), DeploymentStatus.HEALTH_CHECKING, "img:1"));

    watcher.scheduledCheck();
    watcher.scheduledCheck();

    verify(actions, never()).propose(any(), any(), any(), any());
  }

  private DeploymentView view(UUID id, DeploymentStatus status, String image) {
    return new DeploymentView(
        id,
        projectId,
        "abcdef123456",
        null,
        DeploymentTrigger.MANUAL,
        status,
        null,
        null,
        null,
        image,
        null,
        Instant.now(),
        null,
        null,
        List.of());
  }
}
