package com.forge.deployment.application;

import com.forge.jobs.JobPayload;
import java.util.UUID;

/** Payload of a BUILD job. Only the id: the handler reloads fresh state from the database. */
public record BuildJobPayload(UUID deploymentId) implements JobPayload {}
