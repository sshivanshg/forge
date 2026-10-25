package com.forge.jobs;

/** Executes jobs of one {@link JobType}. Implementations are discovered as Spring beans. */
public interface JobHandler {

  JobType type();

  void handle(Job job);

  /** Whether a failure is transient and the job should be tried again later. */
  boolean isRetryable(Throwable error);

  /** Called once when the job fails for good (non-retryable error or no attempts left). */
  void onExhausted(Job job, Throwable error);
}
