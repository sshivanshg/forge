package com.forge.deployment.application;

import com.forge.jobs.JobPayload;
import java.util.UUID;

/** Payload of a DEPLOY job. */
public record DeployJobPayload(UUID deploymentId) implements JobPayload {}
