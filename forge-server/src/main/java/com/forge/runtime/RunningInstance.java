package com.forge.runtime;

import java.net.URI;

/**
 * @param instanceId runtime-specific id (the Docker container id)
 * @param probeUrl base URL the control plane uses to health-check this instance directly
 */
public record RunningInstance(String instanceId, URI probeUrl) {}
