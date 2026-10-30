package com.forge.deployment.infrastructure;

import com.forge.deployment.domain.RuntimeInstanceRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RuntimeInstanceRepository extends JpaRepository<RuntimeInstanceRecord, UUID> {

  @Query("select r from RuntimeInstanceRecord r where r.deploymentId = :deploymentId")
  Optional<RuntimeInstanceRecord> findByDeployment(UUID deploymentId);

  /** Containers of a project that have not been stopped yet. */
  @Query(
      "select r from RuntimeInstanceRecord r, Deployment d where r.deploymentId = d.id and"
          + " d.projectId = :projectId and r.status <> com.forge.deployment.domain"
          + ".RuntimeInstanceRecord.Status.STOPPED")
  List<RuntimeInstanceRecord> findActiveByProject(UUID projectId);
}
