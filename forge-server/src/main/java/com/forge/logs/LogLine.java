package com.forge.logs;

import java.time.Instant;

/**
 * One stored log line. {@code seq} increases per deployment, so a reconnecting client can resume
 * exactly where it stopped.
 */
public record LogLine(int seq, LogSource source, String line, Instant ts) {}
