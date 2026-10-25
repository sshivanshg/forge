package com.forge.build.infrastructure;

import com.forge.build.BuildFailedException;
import com.forge.build.BuildFailedException.Reason;
import com.forge.build.application.ImageBuilder;
import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.exception.DockerClientException;
import com.github.dockerjava.api.exception.DockerException;
import com.github.dockerjava.api.model.BuildResponseItem;
import com.github.dockerjava.api.model.PushResponseItem;
import com.github.dockerjava.core.command.BuildImageResultCallback;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.springframework.stereotype.Component;

/** Adapter: {@link ImageBuilder} on the Docker Engine API (docker-java). */
@Component
class DockerImageBuilder implements ImageBuilder {

  private static final Duration PUSH_TIMEOUT = Duration.ofMinutes(5);

  private final DockerClient docker;

  DockerImageBuilder(DockerClient docker) {
    this.docker = docker;
  }

  @Override
  public void build(
      Path contextDir,
      Path dockerfile,
      String imageRef,
      Duration timeout,
      Consumer<String> output) {
    BuildImageResultCallback callback =
        new BuildImageResultCallback() {
          @Override
          public void onNext(BuildResponseItem item) {
            if (item.getStream() != null) {
              output.accept(item.getStream());
            }
            if (item.isErrorIndicated() && item.getErrorDetail() != null) {
              output.accept("ERROR: " + item.getErrorDetail().getMessage());
            }
            super.onNext(item);
          }
        };
    try {
      docker
          .buildImageCmd()
          .withBaseDirectory(contextDir.toFile())
          .withDockerfile(dockerfile.toFile())
          .withTags(Set.of(imageRef))
          .withPull(true)
          .withRemove(true)
          .withForcerm(true)
          .exec(callback);
      if (!callback.awaitCompletion(timeout.toSeconds(), TimeUnit.SECONDS)) {
        closeQuietly(callback);
        throw new BuildFailedException(
            Reason.BUILD_TIMEOUT, "Build exceeded the " + timeout.toMinutes() + " minute limit");
      }
      callback.awaitImageId(); // rethrows the build error, if any
    } catch (DockerClientException | DockerException e) {
      throw new BuildFailedException(
          Reason.BUILD_FAILED, "docker build failed: " + e.getMessage(), e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      closeQuietly(callback);
      throw new BuildFailedException(Reason.BUILD_FAILED, "Build was interrupted", e);
    }
  }

  @Override
  public void push(String imageRef, Consumer<String> output) {
    AtomicReference<String> error = new AtomicReference<>();
    var callback =
        new ResultCallback.Adapter<PushResponseItem>() {
          @Override
          public void onNext(PushResponseItem item) {
            if (item.isErrorIndicated()) {
              error.set(
                  item.getErrorDetail() != null ? item.getErrorDetail().getMessage() : "unknown");
            } else if (item.getStatus() != null && item.getProgressDetail() == null) {
              output.accept(item.getStatus() + (item.getId() != null ? " " + item.getId() : ""));
            }
          }
        };
    try {
      boolean done =
          docker
              .pushImageCmd(imageRef)
              .exec(callback)
              .awaitCompletion(PUSH_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
      if (!done) {
        throw new BuildFailedException(Reason.PUSH_FAILED, "Push timed out");
      }
    } catch (DockerException | DockerClientException e) {
      throw new BuildFailedException(Reason.PUSH_FAILED, "Push failed: " + e.getMessage(), e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new BuildFailedException(Reason.PUSH_FAILED, "Push was interrupted", e);
    }
    if (error.get() != null) {
      throw new BuildFailedException(Reason.PUSH_FAILED, "Push failed: " + error.get());
    }
  }

  private static void closeQuietly(ResultCallback<?> callback) {
    try {
      callback.close();
    } catch (IOException ignored) {
      // best effort: the stream is being abandoned anyway
    }
  }
}
