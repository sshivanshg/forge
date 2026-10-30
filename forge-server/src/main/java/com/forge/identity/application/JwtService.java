package com.forge.identity.application;

import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.shared.security.AuthenticatedUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/**
 * Issues and verifies stateless access tokens (JWT, HS256). The server keeps no session: the
 * signature proves the token was issued by us and has not been modified.
 */
@Service
public class JwtService {

  private static final String ISSUER = "forge";
  private static final String EMAIL_CLAIM = "email";

  private final SecretKey key;
  private final IdentityProperties properties;
  private final Clock clock;

  public JwtService(IdentityProperties properties, Clock clock) {
    byte[] secret = Decoders.BASE64.decode(properties.jwtSecret());
    if (secret.length < 32) {
      throw new IllegalStateException("forge.identity.jwt-secret must be at least 32 bytes");
    }
    this.key = Keys.hmacShaKeyFor(secret);
    this.properties = properties;
    this.clock = clock;
  }

  public String issueAccessToken(UUID userId, String email) {
    Instant now = clock.instant();
    return Jwts.builder()
        .issuer(ISSUER)
        .subject(userId.toString())
        .claim(EMAIL_CLAIM, email)
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(properties.accessTokenTtl())))
        .signWith(key)
        .compact();
  }

  public long accessTokenTtlSeconds() {
    return properties.accessTokenTtl().toSeconds();
  }

  /**
   * @throws ForgeException with {@link ErrorCode#INVALID_TOKEN} if the token is malformed, tampered
   *     with or expired
   */
  public AuthenticatedUser verify(String token) {
    try {
      Claims claims =
          Jwts.parser()
              .verifyWith(key)
              .requireIssuer(ISSUER)
              .clock(() -> Date.from(clock.instant()))
              .build()
              .parseSignedClaims(token)
              .getPayload();
      return new AuthenticatedUser(
          UUID.fromString(claims.getSubject()), claims.get(EMAIL_CLAIM, String.class));
    } catch (JwtException | IllegalArgumentException e) {
      throw new ForgeException(ErrorCode.INVALID_TOKEN, "Access token is invalid or expired");
    }
  }
}
