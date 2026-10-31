package com.forge.identity.application;

import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param jwtSecret base64 HMAC-SHA256 signing key (at least 32 bytes)
 * @param accessTokenTtl short-lived, so a stolen access token is only useful briefly
 * @param refreshTokenTtl how long a user stays signed in without re-entering the password
 * @param demoEmail with {@code demoPassword}: a demo account created at startup (empty = none)
 * @param demoPassword password of the demo account
 */
@Validated
@ConfigurationProperties("forge.identity")
public record IdentityProperties(
    @NotBlank String jwtSecret,
    @DefaultValue("15m") Duration accessTokenTtl,
    @DefaultValue("30d") Duration refreshTokenTtl,
    String demoEmail,
    String demoPassword) {

  public boolean hasDemoAccount() {
    return demoEmail != null
        && !demoEmail.isBlank()
        && demoPassword != null
        && !demoPassword.isBlank();
  }
}
