package com.forge.shared.web;

import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.shared.logging.MdcKeys;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * The single place where exceptions become HTTP responses. Every error body is an RFC 9457 {@link
 * ProblemDetail} enriched with a stable {@code code} and the request's {@code correlationId}, so a
 * user-reported error can be traced in the logs.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(ForgeException.class)
  ResponseEntity<ProblemDetail> handleForge(ForgeException ex) {
    if (ex.code().status().is5xxServerError()) {
      log.warn("Request failed: {}", ex.getMessage(), ex);
    }
    return problem(ex.code(), ex.getMessage());
  }

  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  ResponseEntity<ProblemDetail> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
    return problem(ErrorCode.CONCURRENT_MODIFICATION, "Please retry the request");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
    log.error("Unhandled exception", ex);
    return problem(ErrorCode.INTERNAL_ERROR, "Something went wrong. Quote the correlationId.");
  }

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail body = baseProblem(ErrorCode.VALIDATION_FAILED, "Request has invalid fields");
    List<Map<String, String>> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(
                e ->
                    Map.of(
                        "field",
                        e.getField(),
                        "message",
                        e.getDefaultMessage() == null ? "invalid" : e.getDefaultMessage()))
            .toList();
    body.setProperty("errors", errors);
    return ResponseEntity.badRequest().body(body);
  }

  /** Enriches the problem details Spring MVC creates for its own exceptions (405, 415, …). */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    if (body instanceof ProblemDetail pd) {
      pd.setProperty("code", status.value() == 404 ? "NOT_FOUND" : "REQUEST_REJECTED");
      pd.setProperty("correlationId", MDC.get(MdcKeys.CORRELATION_ID));
    }
    return super.handleExceptionInternal(ex, body, headers, status, request);
  }

  private static ResponseEntity<ProblemDetail> problem(ErrorCode code, String detail) {
    return ResponseEntity.status(code.status()).body(baseProblem(code, detail));
  }

  private static ProblemDetail baseProblem(ErrorCode code, String detail) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(code.status(), detail);
    pd.setType(URI.create(code.typeUri()));
    pd.setTitle(code.title());
    pd.setProperty("code", code.name());
    pd.setProperty("correlationId", MDC.get(MdcKeys.CORRELATION_ID));
    return pd;
  }
}
