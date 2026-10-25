package com.forge.shared.error;

/**
 * Base of every expected (business) failure in Forge. The {@link ErrorCode} decides the HTTP
 * status; {@code GlobalExceptionHandler} turns it into an RFC 9457 problem response, so controllers
 * never need try/catch.
 */
public class ForgeException extends RuntimeException {

  private final ErrorCode code;

  public ForgeException(ErrorCode code, String detail) {
    super(detail);
    this.code = code;
  }

  public ForgeException(ErrorCode code, String detail, Throwable cause) {
    super(detail, cause);
    this.code = code;
  }

  public ErrorCode code() {
    return code;
  }
}
