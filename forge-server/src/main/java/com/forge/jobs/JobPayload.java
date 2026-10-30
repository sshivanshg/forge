package com.forge.jobs;

import java.util.UUID;

/** Every job in Forge works on one deployment; its id is put in the logging context. */
public interface JobPayload {

  UUID deploymentId();
}
