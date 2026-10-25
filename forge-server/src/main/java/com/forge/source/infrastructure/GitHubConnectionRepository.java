package com.forge.source.infrastructure;

import com.forge.source.domain.GitHubConnection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GitHubConnectionRepository extends JpaRepository<GitHubConnection, UUID> {

  @Query("select c from GitHubConnection c where c.userId = :userId")
  Optional<GitHubConnection> findByUser(UUID userId);
}
