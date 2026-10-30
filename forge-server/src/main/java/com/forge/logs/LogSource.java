package com.forge.logs;

/** Which stage of the pipeline produced a log line. */
public enum LogSource {
  BUILD,
  DEPLOY,
  RUNTIME,
  SYSTEM
}
