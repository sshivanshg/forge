package com.forge.shared.crypto;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets at rest: environment variable values
 * and GitHub access tokens.
 *
 * <p>Ciphertext layout: {@code iv (12 bytes) || ciphertext || GCM tag (16 bytes)}. A fresh random
 * IV is used for every value, so equal plaintexts never produce equal ciphertexts, and the GCM tag
 * makes any tampering fail decryption instead of yielding garbage.
 */
@Service
public class EncryptionService {

  private static final String ALGORITHM = "AES/GCM/NoPadding";
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;

  private final SecretKey key;
  private final SecureRandom random = new SecureRandom();

  public EncryptionService(CryptoProperties properties) {
    byte[] raw = Base64.getDecoder().decode(properties.encryptionKey());
    if (raw.length != 32) {
      throw new IllegalStateException(
          "forge.crypto.encryption-key must be 32 random bytes, base64 encoded (openssl rand"
              + " -base64 32)");
    }
    this.key = new SecretKeySpec(raw, "AES");
  }

  public byte[] encrypt(String plaintext) {
    try {
      byte[] iv = new byte[IV_BYTES];
      random.nextBytes(iv);
      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      return ByteBuffer.allocate(iv.length + ciphertext.length).put(iv).put(ciphertext).array();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Encryption failed", e);
    }
  }

  public String decrypt(byte[] payload) {
    try {
      ByteBuffer buffer = ByteBuffer.wrap(payload);
      byte[] iv = new byte[IV_BYTES];
      buffer.get(iv);
      byte[] ciphertext = new byte[buffer.remaining()];
      buffer.get(ciphertext);
      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (GeneralSecurityException | RuntimeException e) {
      throw new IllegalStateException("Decryption failed: wrong key or tampered data", e);
    }
  }
}
