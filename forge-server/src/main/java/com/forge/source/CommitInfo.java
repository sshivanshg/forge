package com.forge.source;

/** A commit: its full 40-character SHA and the first line of its message. */
public record CommitInfo(String sha, String message) {}
