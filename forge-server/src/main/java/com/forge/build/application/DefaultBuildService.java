package com.forge.build.application;

import com.forge.build.BuildFailedException;
import com.forge.build.BuildFailedException.Reason;
import com.forge.build.BuildRequest;
import com.forge.build.BuildResult;
import com.forge.build.BuildService;
import com.forge.build.BuildType;
import com.forge.build.detect.DetectorChain;
import com.forge.build.strategy.BuildStrategyFactory;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.shared.error.ForgeException;
import com.forge.source.CommitInfo;
import com.forge.source.SourceCodeProvider;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The build pipeline: checkout → detect → prepare Dockerfile → docker build → push. It coordinates
 * collaborators that are all interfaces (source provider, detector chain, strategy factory, image
 * builder, log sink), so each step can be replaced or faked in tests.
 */
@Service
class DefaultBuildService implements BuildService {

  private static final Logger log = LoggerFactory.getLogger(DefaultBuildService.class);

  private final SourceCodeProvider source;
  private final DetectorChain detectors;
  private final BuildStrategyFactory strategies;
  private final ImageBuilder images;
  private final LogSink logs;
  private final BuildProperties properties;

  DefaultBuildService(
      SourceCodeProvider source,
      DetectorChain detectors,
      BuildStrategyFactory strategies,
      ImageBuilder images,
      LogSink logs,
      BuildProperties properties) {
    this.source = source;
    this.detectors = detectors;
    this.strategies = strategies;
    this.images = images;
    this.logs = logs;
    this.properties = properties;
  }

  @Override
  public BuildResult build(BuildRequest request) {
    Path workspace = createWorkspace(request);
    try {
      say(
          request,
          "Cloning " + request.repository().fullName() + " @ " + shortSha(request.commitSha()));
      CommitInfo commit = checkout(request, workspace);
      say(request, "Checked out \"" + commit.message() + "\"");

      Path contextDir = workspace.resolve(request.rootDir()).normalize();
      if (!contextDir.startsWith(workspace) || !Files.isDirectory(contextDir)) {
        throw new BuildFailedException(
            Reason.UNSUPPORTED_PROJECT, "Root directory '" + request.rootDir() + "' not found");
      }

      BuildType type =
          request.buildType() == BuildType.AUTO
              ? detectors.detect(contextDir)
              : request.buildType();
      say(
          request,
          "Build type: " + type + (request.buildType() == BuildType.AUTO ? " (detected)" : ""));
      Path dockerfile = strategies.forType(type).prepare(contextDir, request.port());

      String imageRef = imageRef(request);
      say(request, "Building image " + imageRef);
      images.build(
          contextDir,
          dockerfile,
          imageRef,
          properties.timeout(),
          line -> logs.append(request.deploymentId(), LogSource.BUILD, line));

      if (properties.usesRegistry()) {
        say(request, "Pushing image to " + properties.registry());
        images.push(imageRef, line -> logs.append(request.deploymentId(), LogSource.BUILD, line));
      }
      say(request, "Image ready: " + imageRef);
      return new BuildResult(imageRef, type, commit);
    } finally {
      deleteQuietly(workspace);
    }
  }

  /** Deterministic tag: the same commit always produces the same image name (safe retries). */
  String imageRef(BuildRequest request) {
    String prefix = properties.usesRegistry() ? properties.registry() + "/" : "";
    return prefix + "forge/" + request.projectSlug() + ":" + shortSha(request.commitSha());
  }

  private CommitInfo checkout(BuildRequest request, Path workspace) {
    try {
      return source.checkout(
          request.repository(),
          request.branch(),
          request.commitSha(),
          workspace,
          request.accessToken());
    } catch (ForgeException e) {
      throw new BuildFailedException(Reason.SOURCE_UNAVAILABLE, e.getMessage(), e);
    }
  }

  private Path createWorkspace(BuildRequest request) {
    try {
      Path root =
          properties.workspaceDir() != null
              ? properties.workspaceDir()
              : Path.of(System.getProperty("java.io.tmpdir"), "forge-builds");
      Files.createDirectories(root);
      return Files.createTempDirectory(
          root, request.deploymentId().toString().substring(0, 8) + "-");
    } catch (IOException e) {
      throw new IllegalStateException("Cannot create build workspace", e);
    }
  }

  private void say(BuildRequest request, String message) {
    logs.append(request.deploymentId(), LogSource.SYSTEM, "▶ " + message);
  }

  private static String shortSha(String sha) {
    return sha.length() > 12 ? sha.substring(0, 12) : sha;
  }

  private static void deleteQuietly(Path dir) {
    try (Stream<Path> paths = Files.walk(dir)) {
      paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
    } catch (IOException e) {
      log.warn("Could not delete workspace {}", dir, e);
    }
  }
}
