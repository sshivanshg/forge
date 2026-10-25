package com.forge.build.detect;

import com.forge.build.BuildFailedException;
import com.forge.build.BuildType;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Runs the detectors in {@code @Order} (Spring injects the list already sorted) and returns the
 * first match. Adding a language means adding a detector bean: this class never changes.
 */
@Component
public class DetectorChain {

  private final List<BuildTypeDetector> detectors;

  public DetectorChain(List<BuildTypeDetector> detectors) {
    this.detectors = List.copyOf(detectors);
  }

  public BuildType detect(Path sourceDir) {
    return detectors.stream()
        .map(detector -> detector.detect(sourceDir))
        .flatMap(Optional::stream)
        .findFirst()
        .orElseThrow(
            () ->
                new BuildFailedException(
                    BuildFailedException.Reason.UNSUPPORTED_PROJECT,
                    "Could not detect how to build this project. Add a Dockerfile, pom.xml,"
                        + " build.gradle or package.json (check the project's root directory)."));
  }
}
