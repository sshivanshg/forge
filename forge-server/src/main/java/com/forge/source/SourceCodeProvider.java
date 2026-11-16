package com.forge.source;

import java.nio.file.Path;
import java.util.Optional;

/**
 * Port for reading source code from a Git host. The deployment and build modules depend on this
 * interface only; {@code JGitSourceCodeProvider} is the adapter that implements it.
 */
public interface SourceCodeProvider {

  /**
   * Resolves the current head commit of a branch without cloning.
   *
   * @throws com.forge.shared.error.ForgeException REPOSITORY_UNREACHABLE if the repository or
   *     branch does not exist or is not accessible
   */
  String resolveHead(GitRepository repository, String branch, Optional<String> accessToken);

  /**
   * Checks out exactly {@code commitSha} into {@code targetDir} (which must be empty).
   *
   * @return the checked-out commit, including its message
   */
  CommitInfo checkout(
      GitRepository repository,
      String branch,
      String commitSha,
      Path targetDir,
      Optional<String> accessToken);

  /**
   * The changes from {@code baseSha} to {@code headSha} on {@code branch}, with the patch cut off
   * after {@code maxPatchChars} characters.
   *
   * @throws com.forge.shared.error.ForgeException REPOSITORY_UNREACHABLE if either commit cannot be
   *     read
   */
  CommitDiff compare(
      GitRepository repository,
      String branch,
      String baseSha,
      String headSha,
      Optional<String> accessToken,
      int maxPatchChars);
}
