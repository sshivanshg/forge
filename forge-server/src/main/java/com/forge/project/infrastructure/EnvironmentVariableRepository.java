package com.forge.project.infrastructure;

import com.forge.project.domain.EnvironmentVariable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EnvironmentVariableRepository extends JpaRepository<EnvironmentVariable, UUID> {

  @Query("select e from EnvironmentVariable e where e.projectId = :projectId order by e.key")
  List<EnvironmentVariable> findByProject(UUID projectId);

  @Query("select e from EnvironmentVariable e where e.projectId = :projectId and e.key = :key")
  Optional<EnvironmentVariable> findByProjectAndKey(UUID projectId, String key);
}
