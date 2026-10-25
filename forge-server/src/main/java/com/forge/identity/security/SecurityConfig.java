package com.forge.identity.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.identity.application.JwtService;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.logging.MdcKeys;
import java.net.URI;
import java.util.List;
import org.slf4j.MDC;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT security: no server sessions, no CSRF tokens (we never use cookies for auth), and
 * every endpoint requires a valid access token except the explicit public list below.
 */
@Configuration
public class SecurityConfig {

  private static final String[] PUBLIC_PATHS = {
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/webhooks/**",
    "/api/v1/github/callback",
    "/actuator/health/**",
    "/actuator/prometheus",
    "/swagger-ui/**",
    "/swagger-ui.html",
    "/v3/api-docs/**",
    "/error"
  };

  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http, JwtService jwtService, AuthenticationEntryPoint entryPoint)
      throws Exception {
    return http.csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .httpBasic(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(HttpMethod.OPTIONS, "/**")
                    .permitAll()
                    .requestMatchers(PUBLIC_PATHS)
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint))
        .addFilterBefore(
            new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  /** BCrypt with cost 12: deliberately slow (~250 ms) so offline brute force is expensive. */
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  /** 401 responses use the same RFC 9457 shape as every other error. */
  @Bean
  AuthenticationEntryPoint problemEntryPoint(ObjectMapper objectMapper) {
    return (request, response, ex) -> {
      ProblemDetail pd =
          ProblemDetail.forStatusAndDetail(
              ErrorCode.INVALID_TOKEN.status(), "Missing or invalid access token");
      pd.setType(URI.create(ErrorCode.INVALID_TOKEN.typeUri()));
      pd.setTitle(ErrorCode.INVALID_TOKEN.title());
      pd.setInstance(URI.create(request.getRequestURI()));
      pd.setProperty("code", ErrorCode.INVALID_TOKEN.name());
      pd.setProperty("correlationId", MDC.get(MdcKeys.CORRELATION_ID));
      response.setStatus(pd.getStatus());
      response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
      objectMapper.writeValue(response.getOutputStream(), pd);
    };
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(WebProperties web) {
    CorsConfiguration cors = new CorsConfiguration();
    cors.setAllowedOrigins(web.allowedOrigins());
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Correlation-Id"));
    cors.setExposedHeaders(List.of("Location", "X-Correlation-Id", "X-Forge-Redeploy-Required"));
    cors.setMaxAge(3600L);
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cors);
    return source;
  }

  /**
   * @param allowedOrigins browser origins allowed to call the API (the dashboard)
   */
  @ConfigurationProperties("forge.web")
  public record WebProperties(List<String> allowedOrigins) {
    public WebProperties {
      allowedOrigins = allowedOrigins == null ? List.of("http://localhost:3000") : allowedOrigins;
    }
  }
}
