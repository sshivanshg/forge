package com.forge.deployment.infrastructure;

import com.forge.deployment.domain.DeploymentEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DeploymentEventRepository extends JpaRepository<DeploymentEvent, Long> {

  @Query("select e from DeploymentEvent e where e.deploymentId = :deploymentId order by e.id")
  List<DeploymentEvent> findTimeline(UUID deploymentId);
}
