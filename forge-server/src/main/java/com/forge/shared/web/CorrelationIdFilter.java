package com.forge.shared.web;

import com.forge.shared.logging.MdcKeys;
import com.forge.shared.logging.MdcScope;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every request a correlation id (reusing a caller-supplied {@code X-Correlation-Id} when it
 * is well formed), puts it in the MDC for logging and echoes it in the response header.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

  public static final String HEADER = "X-Correlation-Id";
  private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9-]{8,64}");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String incoming = request.getHeader(HEADER);
    String correlationId =
        incoming != null && SAFE_ID.matcher(incoming).matches()
            ? incoming
            : UUID.randomUUID().toString();
    response.setHeader(HEADER, correlationId);
    try (var ignored = MdcScope.of(MdcKeys.CORRELATION_ID, correlationId)) {
      chain.doFilter(request, response);
    }
  }
}
