package com.forge.build.application;

import java.nio.file.Path;
import java.time.Duration;
import java.util.function.Consumer;

/** Port: build and push container images. {@code DockerImageBuilder} is the adapter. */
public interface ImageBuilder {

  /**
   * Builds {@code dockerfile} with {@code contextDir} as build context and tags it {@code
   * imageRef}. Every output line is passed to {@code output}.
   */
  void build(
      Path contextDir, Path dockerfile, String imageRef, Duration timeout, Consumer<String> output);

  void push(String imageRef, Consumer<String> output);
}
