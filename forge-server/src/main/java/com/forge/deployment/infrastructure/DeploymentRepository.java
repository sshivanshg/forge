package com.forge.deployment.infrastructure;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.domain.Deployment;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DeploymentRepository extends JpaRepository<Deployment, UUID> {

  @Query("select d from Deployment d where d.projectId = :projectId")
  Page<Deployment> findByProject(UUID projectId, Pageable pageable);

  @Query("select d from Deployment d where d.projectId = :projectId and d.status in :statuses")
  List<Deployment> findByProjectAndStatusIn(UUID projectId, Collection<DeploymentStatus> statuses);

  /** Is another deployment of this project currently building, deploying or health-checking? */
  @Query(
      "select count(d) > 0 from Deployment d where d.projectId = :projectId and d.id <> :excludeId"
          + " and d.status in (com.forge.deployment.DeploymentStatus.BUILDING,"
          + " com.forge.deployment.DeploymentStatus.DEPLOYING,"
          + " com.forge.deployment.DeploymentStatus.HEALTH_CHECKING)")
  boolean anotherInProgress(UUID projectId, UUID excludeId);

  @Query("select d from Deployment d where d.status = com.forge.deployment.DeploymentStatus.LIVE")
  List<Deployment> findLive();

  /** Has Forge already tried to recover this deployment (successfully or not)? */
  @Query(
      "select count(d) > 0 from Deployment d where d.rollbackOfId = :liveId"
          + " and d.trigger = com.forge.deployment.DeploymentTrigger.RECOVERY")
  boolean recoveryAttempted(UUID liveId);
}
