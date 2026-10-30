package com.forge.shared.error;

/**
 * A domain object rejected its input (for example an invalid slug or port). Thrown by value objects
 * and entities so invariants are enforced in the model itself, not only in the API layer.
 */
public class ValidationException extends ForgeException {

  public ValidationException(String detail) {
    super(ErrorCode.VALIDATION_FAILED, detail);
  }
}
