package com.forge.jobs;

/** Kinds of background work. Each type has exactly one {@link JobHandler}. */
public enum JobType {
  /** Clone the commit, build the image, push it. */
  BUILD,
  /** Start the image, health-check it, switch traffic. */
  DEPLOY
}
