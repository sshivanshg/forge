package com.forge.build.detect;

import com.forge.build.BuildType;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * The concrete detectors. {@link Order} sets their priority: a user's own Dockerfile always wins
 * over Forge's generated ones.
 */
final class Detectors {

  private Detectors() {}

  /** Shared logic: "this build type applies when one of these files exists". */
  abstract static class MarkerFileDetector implements BuildTypeDetector {

    private final BuildType type;
    private final String[] markers;

    MarkerFileDetector(BuildType type, String... markers) {
      this.type = type;
      this.markers = markers;
    }

    @Override
    public Optional<BuildType> detect(Path sourceDir) {
      for (String marker : markers) {
        if (Files.isRegularFile(sourceDir.resolve(marker))) {
          return Optional.of(type);
        }
      }
      return Optional.empty();
    }
  }

  @Component
  @Order(1)
  static class DockerfileDetector extends MarkerFileDetector {
    DockerfileDetector() {
      super(BuildType.DOCKERFILE, "Dockerfile");
    }
  }

  @Component
  @Order(2)
  static class MavenDetector extends MarkerFileDetector {
    MavenDetector() {
      super(BuildType.MAVEN, "pom.xml");
    }
  }

  @Component
  @Order(3)
  static class GradleDetector extends MarkerFileDetector {
    GradleDetector() {
      super(BuildType.GRADLE, "build.gradle.kts", "build.gradle");
    }
  }

  @Component
  @Order(4)
  static class NodeDetector extends MarkerFileDetector {
    NodeDetector() {
      super(BuildType.NODE, "package.json");
    }
  }
}
