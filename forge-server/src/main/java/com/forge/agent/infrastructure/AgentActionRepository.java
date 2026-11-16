package com.forge.agent.infrastructure;

import com.forge.agent.domain.ActionStatus;
import com.forge.agent.domain.ActionType;
import com.forge.agent.domain.AgentAction;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentActionRepository extends JpaRepository<AgentAction, UUID> {

  List<AgentAction> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

  List<AgentAction> findByDeploymentIdOrderByCreatedAtDesc(UUID deploymentId);

  Optional<AgentAction> findFirstByProjectIdAndTypeAndStatus(
      UUID projectId, ActionType type, ActionStatus status);

  List<AgentAction> findByProjectIdAndStatus(UUID projectId, ActionStatus status);
}
