package com.forge.build.strategy;

import com.forge.build.BuildFailedException;
import com.forge.build.BuildType;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

/** The repository brings its own Dockerfile: use it unchanged. */
@Component
class DockerfileBuildStrategy implements BuildStrategy {

  @Override
  public BuildType type() {
    return BuildType.DOCKERFILE;
  }

  @Override
  public Path prepare(Path contextDir, int port) {
    Path dockerfile = contextDir.resolve("Dockerfile");
    if (!Files.isRegularFile(dockerfile)) {
      throw new BuildFailedException(
          BuildFailedException.Reason.UNSUPPORTED_PROJECT,
          "Build type is DOCKERFILE but no Dockerfile exists in the root directory");
    }
    return dockerfile;
  }
}
