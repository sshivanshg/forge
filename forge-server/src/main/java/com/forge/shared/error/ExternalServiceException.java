package com.forge.shared.error;

/**
 * A dependency outside our control (GitHub, Docker, the registry) failed. These failures are
 * usually transient, so job handlers treat them as retryable.
 */
public class ExternalServiceException extends ForgeException {

  public ExternalServiceException(String detail, Throwable cause) {
    super(ErrorCode.EXTERNAL_SERVICE_FAILED, detail, cause);
  }
}
