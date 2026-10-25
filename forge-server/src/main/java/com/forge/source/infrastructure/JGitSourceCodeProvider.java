package com.forge.source.infrastructure;

import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.source.CommitInfo;
import com.forge.source.GitRepository;
import com.forge.source.SourceCodeProvider;
import com.forge.source.application.GitHubProperties;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adapter: implements {@link SourceCodeProvider} with JGit (pure Java, no git binary needed).
 *
 * <p>Checkout strategy: a shallow clone (depth 1) of the branch is fast and is enough when the
 * requested commit is still the branch head. If the branch has moved on, the clone is deepened and
 * the exact commit is checked out, so a deployment always builds precisely the commit it recorded.
 */
@Component
class JGitSourceCodeProvider implements SourceCodeProvider {

  private static final Logger log = LoggerFactory.getLogger(JGitSourceCodeProvider.class);
  private static final int TIMEOUT_SECONDS = 120;

  private final GitHubProperties properties;

  JGitSourceCodeProvider(GitHubProperties properties) {
    this.properties = properties;
  }

  @Override
  public String resolveHead(GitRepository repository, String branch, Optional<String> accessToken) {
    try {
      Map<String, Ref> refs =
          Git.lsRemoteRepository()
              .setRemote(cloneUrl(repository))
              .setHeads(true)
              .setTimeout(TIMEOUT_SECONDS)
              .setCredentialsProvider(credentials(accessToken))
              .callAsMap();
      Ref ref = refs.get("refs/heads/" + branch);
      if (ref == null) {
        throw unreachable("Branch '" + branch + "' not found in " + repository.fullName());
      }
      return ref.getObjectId().name();
    } catch (GitAPIException e) {
      throw unreachable(
          "Cannot reach " + repository.fullName() + ". Is it public, or is GitHub connected?");
    }
  }

  @Override
  public CommitInfo checkout(
      GitRepository repository,
      String branch,
      String commitSha,
      Path targetDir,
      Optional<String> accessToken) {
    CredentialsProvider credentials = credentials(accessToken);
    try (Git git =
        Git.cloneRepository()
            .setURI(cloneUrl(repository))
            .setDirectory(targetDir.toFile())
            .setBranch(branch)
            .setDepth(1)
            .setTimeout(TIMEOUT_SECONDS)
            .setCredentialsProvider(credentials)
            .call()) {
      ObjectId head = git.getRepository().resolve("HEAD");
      if (head == null || !head.name().equals(commitSha)) {
        log.info("Branch moved past {}; deepening clone to check out the exact commit", commitSha);
        git.fetch().setUnshallow(true).setCredentialsProvider(credentials).call();
        git.checkout().setName(commitSha).call();
      }
      RevCommit commit = git.log().setMaxCount(1).call().iterator().next();
      return new CommitInfo(commit.getName(), commit.getShortMessage());
    } catch (GitAPIException | java.io.IOException e) {
      throw unreachable("Checkout of " + commitSha + " failed: " + e.getMessage());
    }
  }

  String cloneUrl(GitRepository repository) {
    String base = properties.gitBaseUrl().replaceAll("/+$", "");
    return base + "/" + repository.owner() + "/" + repository.name() + ".git";
  }

  private static CredentialsProvider credentials(Optional<String> accessToken) {
    // GitHub accepts an OAuth token as the password of any username over HTTPS.
    return accessToken
        .<CredentialsProvider>map(t -> new UsernamePasswordCredentialsProvider("x-access-token", t))
        .orElse(CredentialsProvider.getDefault());
  }

  private static ForgeException unreachable(String detail) {
    return new ForgeException(ErrorCode.REPOSITORY_UNREACHABLE, detail);
  }
}
