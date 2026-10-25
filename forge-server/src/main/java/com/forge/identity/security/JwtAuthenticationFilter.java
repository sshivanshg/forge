package com.forge.identity.security;

import com.forge.identity.application.JwtService;
import com.forge.shared.error.ForgeException;
import com.forge.shared.security.AuthenticatedUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the access token, verifies it and stores the {@link AuthenticatedUser} in the security
 * context. An invalid token simply leaves the request anonymous; Spring Security then answers 401
 * for protected paths.
 *
 * <p>Browsers' EventSource API cannot set headers, so for Server-Sent Event endpoints (paths ending
 * in {@code /stream}) the token may also come from the {@code access_token} query parameter.
 */
class JwtAuthenticationFilter extends OncePerRequestFilter {

  private static final String BEARER = "Bearer ";

  private final JwtService jwtService;

  JwtAuthenticationFilter(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String token = extractToken(request);
    if (token != null) {
      try {
        AuthenticatedUser user = jwtService.verify(token);
        var authentication = new UsernamePasswordAuthenticationToken(user, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
      } catch (ForgeException invalid) {
        SecurityContextHolder.clearContext();
      }
    }
    chain.doFilter(request, response);
  }

  private static String extractToken(HttpServletRequest request) {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith(BEARER)) {
      return header.substring(BEARER.length());
    }
    if (request.getRequestURI().endsWith("/stream")) {
      return request.getParameter("access_token");
    }
    return null;
  }
}
