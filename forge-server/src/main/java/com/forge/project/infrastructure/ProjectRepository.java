package com.forge.project.infrastructure;

import com.forge.project.domain.Project;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

  /** Ownership is part of the query itself, so another user's project is simply "not found". */
  @Query("select p from Project p where p.id = :id and p.ownerId = :ownerId")
  Optional<Project> findOwned(UUID id, UUID ownerId);

  @Query("select p from Project p where p.ownerId = :ownerId")
  Page<Project> findAllOwned(UUID ownerId, Pageable pageable);

  boolean existsBySlug(String slug);

  @Query(
      "select p from Project p where lower(p.repoOwner) = lower(:owner) and lower(p.repoName) ="
          + " lower(:name) and p.branch = :branch and p.autoDeploy = true")
  List<Project> findAutoDeployTargets(String owner, String name, String branch);
}
