package com.forge.agent.application;

import com.forge.agent.domain.ActionPlan;
import com.forge.agent.domain.SettingsPatch;
import com.forge.build.BuildType;
import com.forge.project.ProjectSnapshot;
import com.forge.source.GitHubAccounts;
import com.forge.source.GitRepository;
import com.forge.source.SourceCodeProvider;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Auto-configuration: when Forge cannot detect how to build a repository, the agent checks out the
 * failed commit, looks for a buildable project in sub-folders (a monorepo, or {@code backend/}),
 * and guesses the port the app listens on. It proposes those settings; it never applies them.
 */
@Component
class RepositoryInspector {

  private static final Logger log = LoggerFactory.getLogger(RepositoryInspector.class);
  private static final int MAX_DEPTH = 3;
  private static final List<String> SKIP =
      List.of("node_modules", ".git", "target", "build", "dist", ".next", "vendor");

  /** Marker file per build type, in the same priority order as the build module's detectors. */
  private static final List<Marker> MARKERS =
      List.of(
          new Marker("Dockerfile", BuildType.DOCKERFILE),
          new Marker("pom.xml", BuildType.MAVEN),
          new Marker("build.gradle", BuildType.GRADLE),
          new Marker("build.gradle.kts", BuildType.GRADLE),
          new Marker("package.json", BuildType.NODE));

  private static final Pattern EXPOSE = Pattern.compile("(?im)^\\s*EXPOSE\\s+(\\d{2,5})");
  private static final Pattern SERVER_PORT =
      Pattern.compile("(?m)^\\s*server\\.port\\s*[=:]\\s*(?:\\$\\{PORT:)?(\\d{2,5})");
  private static final Pattern NODE_PORT =
      Pattern.compile("(?:PORT\\s*\\|\\|\\s*|\\?\\?\\s*|listen\\(\\s*)(\\d{2,5})");

  private final SourceCodeProvider source;
  private final GitHubAccounts gitHub;

  RepositoryInspector(SourceCodeProvider source, GitHubAccounts gitHub) {
    this.source = source;
    this.gitHub = gitHub;
  }

  /** A settings proposal for {@code commitSha}, or empty if nothing buildable was found. */
  Optional<ActionPlan> proposeSetup(ProjectSnapshot project, String commitSha) {
    Path dir = null;
    try {
      dir = Files.createTempDirectory("forge-inspect-");
      Path checkout = dir.resolve("src");
      source.checkout(
          new GitRepository(project.repoOwner(), project.repoName()),
          project.branch(),
          commitSha,
          checkout,
          gitHub.accessTokenFor(project.ownerId()));
      return inspect(checkout).flatMap(found -> toPlan(found, project, commitSha));
    } catch (IOException | RuntimeException e) {
      log.warn("Agent could not inspect {}: {}", project.slug(), e.getMessage());
      return Optional.empty();
    } finally {
      deleteQuietly(dir);
    }
  }

  /** The shallowest buildable folder in the checkout. Package-private for tests. */
  static Optional<Found> inspect(Path root) throws IOException {
    try (Stream<Path> paths = Files.walk(root, MAX_DEPTH)) {
      return paths
          .filter(Files::isRegularFile)
          .filter(
              p -> SKIP.stream().noneMatch(s -> root.relativize(p).toString().contains(s + "/")))
          .flatMap(
              p ->
                  markerFor(p)
                      .map(m -> new Found(root.relativize(p.getParent()), m.type(), p))
                      .stream())
          .min(
              Comparator.comparingInt((Found f) -> f.dir().getNameCount())
                  .thenComparingInt(f -> priority(f.type())))
          .map(
              f ->
                  new Found(
                      f.dir(), f.type(), f.marker(), guessPort(root.resolve(f.dir()), f.type())));
    }
  }

  private Optional<ActionPlan> toPlan(Found found, ProjectSnapshot project, String commitSha) {
    String rootDir = found.dir().toString().isEmpty() ? "." : found.dir().toString();
    Integer port = found.port().filter(p -> p != project.port()).orElse(null);
    SettingsPatch patch =
        new SettingsPatch(
            rootDir.equals(project.rootDir()) ? null : rootDir,
            found.type() == project.buildType() ? null : found.type(),
            port,
            null,
            null);
    if (patch.isEmpty()) {
      return Optional.empty(); // the settings already match: the problem is elsewhere
    }
    String where = rootDir.equals(".") ? "the repository root" : "'" + rootDir + "'";
    StringBuilder why =
        new StringBuilder("Found ")
            .append(found.marker().getFileName())
            .append(" in ")
            .append(where)
            .append(", so this looks like a ")
            .append(found.type().name().toLowerCase())
            .append(" project.");
    found.port().ifPresent(p -> why.append(" The code listens on port ").append(p).append('.'));
    return Optional.of(
        ActionPlan.updateSettings(
            patch,
            commitSha,
            "Build " + where + " as " + found.type().name().toLowerCase() + " and redeploy",
            why.toString()));
  }

  static Optional<Integer> guessPort(Path dir, BuildType type) {
    List<String> candidates =
        switch (type) {
          case DOCKERFILE -> List.of("Dockerfile");
          case MAVEN, GRADLE ->
              List.of(
                  "src/main/resources/application.properties",
                  "src/main/resources/application.yml",
                  "src/main/resources/application.yaml");
          case NODE ->
              List.of(
                  "server.js",
                  "index.js",
                  "app.js",
                  "src/index.js",
                  "src/server.js",
                  "src/index.ts",
                  "src/main.ts");
          case AUTO -> List.of();
        };
    Pattern pattern =
        switch (type) {
          case DOCKERFILE -> EXPOSE;
          case MAVEN, GRADLE -> SERVER_PORT;
          default -> NODE_PORT;
        };
    for (String name : candidates) {
      Path file = dir.resolve(name);
      if (Files.isRegularFile(file)) {
        try {
          Matcher m = pattern.matcher(Files.readString(file, StandardCharsets.UTF_8));
          if (m.find()) {
            return Optional.of(Integer.parseInt(m.group(1)));
          }
        } catch (IOException | RuntimeException ignored) {
          // unreadable or binary: keep looking
        }
      }
    }
    return type == BuildType.MAVEN || type == BuildType.GRADLE
        ? Optional.of(8080)
        : Optional.empty();
  }

  private static Optional<Marker> markerFor(Path file) {
    String name = file.getFileName().toString();
    return MARKERS.stream().filter(m -> m.fileName().equals(name)).findFirst();
  }

  private static int priority(BuildType type) {
    for (int i = 0; i < MARKERS.size(); i++) {
      if (MARKERS.get(i).type() == type) {
        return i;
      }
    }
    return MARKERS.size();
  }

  private static void deleteQuietly(Path dir) {
    if (dir == null) {
      return;
    }
    try (Stream<Path> paths = Files.walk(dir)) {
      paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
    } catch (IOException ignored) {
      // a leftover temp directory is harmless
    }
  }

  private record Marker(String fileName, BuildType type) {}

  record Found(Path dir, BuildType type, Path marker, Optional<Integer> port) {
    Found(Path dir, BuildType type, Path marker) {
      this(dir, type, marker, Optional.empty());
    }
  }
}
