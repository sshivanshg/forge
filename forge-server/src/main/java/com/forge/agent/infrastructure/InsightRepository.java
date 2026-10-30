package com.forge.agent.infrastructure;

import com.forge.agent.domain.Insight;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InsightRepository extends JpaRepository<Insight, UUID> {}
