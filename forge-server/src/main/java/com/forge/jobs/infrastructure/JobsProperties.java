package com.forge.jobs.infrastructure;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param enabled whether this instance runs workers (tests turn it off and drive jobs by hand)
 * @param pollInterval how often idle workers look for work
 * @param lease how long a claimed job is owned before it is considered abandoned
 * @param maxConcurrent jobs this instance runs at the same time (back-pressure)
 */
@ConfigurationProperties("forge.jobs")
public record JobsProperties(
    @DefaultValue("true") boolean enabled,
    @DefaultValue("2s") Duration pollInterval,
    @DefaultValue("5m") Duration lease,
    @DefaultValue("2") int maxConcurrent) {}
