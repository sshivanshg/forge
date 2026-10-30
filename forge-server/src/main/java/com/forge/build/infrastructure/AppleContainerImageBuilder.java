package com.forge.build.infrastructure;

import com.forge.build.BuildFailedException;
import com.forge.build.BuildFailedException.Reason;
import com.forge.build.application.ImageBuilder;
import com.forge.shared.container.ContainerCli;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.function.Consumer;

/**
 * Adapter: {@link ImageBuilder} on Apple's {@code container build}, which runs BuildKit inside its
 * own small VM. Images stay in the local image store, where the Apple runtime starts them from, so
 * {@link #push} is only needed when a registry is configured.
 */
class AppleContainerImageBuilder implements ImageBuilder {

  private static final Duration PUSH_TIMEOUT = Duration.ofMinutes(5);
  private static final int ERROR_CONTEXT_LINES = 5;

  private final ContainerCli cli;
  private final int builderMemoryMb;

  AppleContainerImageBuilder(ContainerCli cli, int builderMemoryMb) {
    this.cli = cli;
    this.builderMemoryMb = builderMemoryMb;
  }

  @Override
  public void build(
      Path contextDir,
      Path dockerfile,
      String imageRef,
      Duration timeout,
      Consumer<String> output) {
    Deque<String> tail = new ArrayDeque<>();
    Consumer<String> recording =
        line -> {
          output.accept(line);
          tail.addLast(line);
          if (tail.size() > ERROR_CONTEXT_LINES) {
            tail.removeFirst();
          }
        };
    int exit;
    try {
      exit =
          cli.stream(
              timeout,
              recording,
              "build",
              "--progress",
              "plain",
              "--memory",
              builderMemoryMb + "M",
              "--file",
              dockerfile.toString(),
              "--tag",
              imageRef,
              contextDir.toString());
    } catch (ContainerCli.TimeoutException e) {
      throw new BuildFailedException(
          Reason.BUILD_TIMEOUT, "Build exceeded the " + timeout.toMinutes() + " minute limit");
    }
    if (exit != 0) {
      throw new BuildFailedException(
          Reason.BUILD_FAILED,
          "container build failed (exit " + exit + "): " + String.join(" | ", tail));
    }
  }

  @Override
  public void push(String imageRef, Consumer<String> output) {
    int exit;
    try {
      exit = cli.stream(PUSH_TIMEOUT, output, "image", "push", "--progress", "plain", imageRef);
    } catch (ContainerCli.TimeoutException e) {
      throw new BuildFailedException(Reason.PUSH_FAILED, "Push timed out");
    }
    if (exit != 0) {
      throw new BuildFailedException(Reason.PUSH_FAILED, "Push failed (exit " + exit + ")");
    }
  }
}
