package com.forge.project;

import java.util.UUID;

/**
 * Published synchronously, inside the delete transaction and <em>before</em> the row is removed, so
 * the deployment module can stop the project's running containers first.
 */
public record ProjectDeleting(UUID projectId, String slug) {}
