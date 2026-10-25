package com.forge.shared.error;

import org.springframework.http.HttpStatus;

/** Stable, machine-readable error codes. Clients switch on {@code code}, never on messages. */
public enum ErrorCode {
  VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Validation failed"),
  NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
  INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid credentials"),
  INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "Invalid or expired token"),
  INVALID_WEBHOOK_SIGNATURE(HttpStatus.UNAUTHORIZED, "Invalid webhook signature"),
  EMAIL_TAKEN(HttpStatus.CONFLICT, "Email already registered"),
  SLUG_TAKEN(HttpStatus.CONFLICT, "Project slug already taken"),
  ILLEGAL_STATE_TRANSITION(HttpStatus.CONFLICT, "Illegal deployment state transition"),
  CONCURRENT_MODIFICATION(HttpStatus.CONFLICT, "Resource was modified concurrently"),
  NOT_CANCELLABLE(HttpStatus.CONFLICT, "Deployment can no longer be cancelled"),
  NOT_ROLLBACKABLE(HttpStatus.UNPROCESSABLE_ENTITY, "Deployment cannot be rolled back to"),
  GITHUB_NOT_CONNECTED(HttpStatus.UNPROCESSABLE_ENTITY, "GitHub account not connected"),
  GITHUB_OAUTH_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "GitHub OAuth is not configured"),
  REPOSITORY_UNREACHABLE(HttpStatus.UNPROCESSABLE_ENTITY, "Repository or branch not reachable"),
  EXTERNAL_SERVICE_FAILED(HttpStatus.BAD_GATEWAY, "An external service failed"),
  INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Internal error");

  private final HttpStatus status;
  private final String title;

  ErrorCode(HttpStatus status, String title) {
    this.status = status;
    this.title = title;
  }

  public HttpStatus status() {
    return status;
  }

  public String title() {
    return title;
  }

  /** URI used as the RFC 9457 {@code type} member. */
  public String typeUri() {
    return "https://forge.dev/errors/" + name().toLowerCase().replace('_', '-');
  }
}
