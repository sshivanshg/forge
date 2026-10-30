package com.forge.build.application;

import com.forge.build.BuildFailedException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Decorator: wraps any {@link ImageBuilder} and retries pushes, which fail transiently (registry
 * restarting, network blip). It implements the same interface, so callers cannot tell the
 * difference, and the wrapped builder stays unaware of retries (Open/Closed).
 *
 * <p>Builds are not retried: a failed build is a problem in the user's code, and repeating it would
 * fail the same way.
 */
public class RetryingImageBuilder implements ImageBuilder {

  private static final Logger log = LoggerFactory.getLogger(RetryingImageBuilder.class);

  private final ImageBuilder delegate;
  private final int maxAttempts;
  private final Duration initialDelay;

  public RetryingImageBuilder(ImageBuilder delegate, int maxAttempts, Duration initialDelay) {
    if (maxAttempts < 1) {
      throw new IllegalArgumentException("maxAttempts must be at least 1");
    }
    this.delegate = delegate;
    this.maxAttempts = maxAttempts;
    this.initialDelay = initialDelay;
  }

  @Override
  public void build(
      Path contextDir,
      Path dockerfile,
      String imageRef,
      Duration timeout,
      Consumer<String> output) {
    delegate.build(contextDir, dockerfile, imageRef, timeout, output);
  }

  @Override
  public void push(String imageRef, Consumer<String> output) {
    Duration delay = initialDelay;
    for (int attempt = 1; ; attempt++) {
      try {
        delegate.push(imageRef, output);
        return;
      } catch (BuildFailedException e) {
        if (e.reason() != BuildFailedException.Reason.PUSH_FAILED || attempt >= maxAttempts) {
          throw e;
        }
        output.accept(
            "Push failed (attempt "
                + attempt
                + "/"
                + maxAttempts
                + "), retrying in "
                + delay.toSeconds()
                + "s: "
                + e.getMessage());
        log.warn("Push of {} failed on attempt {}: {}", imageRef, attempt, e.getMessage());
        sleep(delay);
        delay = delay.multipliedBy(2);
      }
    }
  }

  private static void sleep(Duration delay) {
    try {
      Thread.sleep(delay);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new BuildFailedException(
          BuildFailedException.Reason.PUSH_FAILED, "Push interrupted", e);
    }
  }
}
