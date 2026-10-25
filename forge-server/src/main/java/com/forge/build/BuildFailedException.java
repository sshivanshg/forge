package com.forge.build;

/**
 * The build could not produce an image. Not retried: building the same commit again would fail the
 * same way. The reason is recorded on the deployment.
 */
public class BuildFailedException extends RuntimeException {

  /** Why the build failed. */
  public enum Reason {
    SOURCE_UNAVAILABLE,
    UNSUPPORTED_PROJECT,
    BUILD_FAILED,
    BUILD_TIMEOUT,
    PUSH_FAILED
  }

  private final Reason reason;

  public BuildFailedException(Reason reason, String message) {
    super(message);
    this.reason = reason;
  }

  public BuildFailedException(Reason reason, String message, Throwable cause) {
    super(message, cause);
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
