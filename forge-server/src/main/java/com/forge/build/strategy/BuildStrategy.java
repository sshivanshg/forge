package com.forge.build.strategy;

import com.forge.build.BuildType;
import java.nio.file.Path;

/**
 * Strategy: how to obtain a Dockerfile for one kind of project. All strategies are interchangeable;
 * {@link BuildStrategyFactory} picks one at runtime from the detected type.
 */
public interface BuildStrategy {

  BuildType type();

  /**
   * Prepares the build context and returns the Dockerfile to build with.
   *
   * @param contextDir the project's root directory inside the checked-out repository
   * @param port the port the app must listen on
   */
  Path prepare(Path contextDir, int port);
}
