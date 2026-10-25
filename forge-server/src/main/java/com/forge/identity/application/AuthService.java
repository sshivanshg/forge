package com.forge.identity.application;

import com.forge.identity.UserLookup.UserSummary;
import com.forge.identity.domain.RefreshToken;
import com.forge.identity.domain.User;
import com.forge.identity.infrastructure.RefreshTokenRepository;
import com.forge.identity.infrastructure.UserRepository;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Use cases: register, log in, refresh (with rotation) and log out. */
@Service
public class AuthService {

  private static final Logger log = LoggerFactory.getLogger(AuthService.class);

  private final UserRepository users;
  private final RefreshTokenRepository refreshTokens;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final IdentityProperties properties;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  /** Hash compared against when the email is unknown, so both paths take the same time. */
  private final String dummyHash;

  public AuthService(
      UserRepository users,
      RefreshTokenRepository refreshTokens,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      IdentityProperties properties,
      Clock clock) {
    this.users = users;
    this.refreshTokens = refreshTokens;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.properties = properties;
    this.clock = clock;
    this.dummyHash = passwordEncoder.encode("timing-attack-dummy-password");
  }

  @Transactional
  public UserSummary register(String email, String password, String displayName) {
    String normalised = User.normaliseEmail(email);
    if (users.existsByEmail(normalised)) {
      throw new ForgeException(ErrorCode.EMAIL_TAKEN, "An account with this email already exists");
    }
    User user =
        users.save(
            User.register(
                normalised, passwordEncoder.encode(password), displayName, clock.instant()));
    log.info("Registered user {}", user.id());
    return new UserSummary(user.id(), user.email(), user.displayName());
  }

  @Transactional
  public TokenPair login(String email, String password) {
    User user = users.findByEmail(User.normaliseEmail(email)).orElse(null);
    String hash = user == null ? dummyHash : user.passwordHash();
    boolean matches = passwordEncoder.matches(password, hash);
    if (user == null || !matches) {
      // Same message for "no such user" and "wrong password": no account enumeration.
      throw new ForgeException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
    }
    return issueTokens(user);
  }

  /**
   * Exchanges a refresh token for a new pair and revokes the old one (rotation). Presenting an
   * already-revoked token means it was probably stolen, so every session of that user is ended.
   */
  @Transactional(noRollbackFor = ForgeException.class)
  public TokenPair refresh(String rawRefreshToken) {
    Instant now = clock.instant();
    RefreshToken token =
        refreshTokens
            .findByTokenHash(sha256(rawRefreshToken))
            .orElseThrow(() -> invalidToken("Unknown refresh token"));
    if (token.isRevoked()) {
      int killed = refreshTokens.revokeAllForUser(token.userId(), now);
      log.warn(
          "Revoked refresh token replayed for user {}; ended {} sessions", token.userId(), killed);
      throw invalidToken("Refresh token was already used");
    }
    if (!token.isActive(now)) {
      throw invalidToken("Refresh token expired");
    }
    token.revoke(now);
    User user =
        users.findById(token.userId()).orElseThrow(() -> invalidToken("User no longer exists"));
    return issueTokens(user);
  }

  @Transactional
  public void logout(String rawRefreshToken) {
    refreshTokens
        .findByTokenHash(sha256(rawRefreshToken))
        .ifPresent(token -> token.revoke(clock.instant()));
  }

  private TokenPair issueTokens(User user) {
    Instant now = clock.instant();
    String rawRefresh = newRandomToken();
    refreshTokens.save(
        new RefreshToken(
            user.id(), sha256(rawRefresh), now, now.plus(properties.refreshTokenTtl())));
    return new TokenPair(
        jwtService.issueAccessToken(user.id(), user.email()),
        rawRefresh,
        jwtService.accessTokenTtlSeconds());
  }

  private String newRandomToken() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  static String sha256(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private static ForgeException invalidToken(String detail) {
    return new ForgeException(ErrorCode.INVALID_TOKEN, detail);
  }
}
