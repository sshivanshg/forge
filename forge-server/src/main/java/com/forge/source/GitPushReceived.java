package com.forge.source;

/**
 * Domain event: GitHub reported a push (signature verified, delivery de-duplicated). Published
 * synchronously inside the webhook transaction; the deployment module reacts by queueing
 * deployments for every auto-deploy project that tracks this branch.
 */
public record GitPushReceived(
    String repoOwner, String repoName, String branch, String commitSha, String commitMessage) {}
