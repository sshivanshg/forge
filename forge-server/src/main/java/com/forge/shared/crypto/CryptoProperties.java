package com.forge.shared.crypto;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param encryptionKey base64 of 32 random bytes. Supplied through the environment, never
 *     committed.
 */
@Validated
@ConfigurationProperties("forge.crypto")
public record CryptoProperties(@NotBlank String encryptionKey) {}
