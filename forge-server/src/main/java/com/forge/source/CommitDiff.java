package com.forge.source;

import java.util.List;

/**
 * What changed between two commits: the changed paths and a unified patch, cut off at a size limit
 * so it can be shown to a person or an LLM.
 */
public record CommitDiff(
    String baseSha, String headSha, List<String> changedFiles, String patch, boolean truncated) {

  public CommitDiff {
    changedFiles = List.copyOf(changedFiles);
  }
}
