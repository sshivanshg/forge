package com.forge.shared;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.forge.shared.crypto.CryptoProperties;
import com.forge.shared.crypto.EncryptionService;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class EncryptionServiceTest {

  private final EncryptionService encryption =
      new EncryptionService(
          new CryptoProperties(Base64.getEncoder().encodeToString(new byte[32])));

  @Test
  void roundTrips() {
    byte[] ciphertext = encryption.encrypt("postgres://user:secret@db/app");
    assertThat(encryption.decrypt(ciphertext)).isEqualTo("postgres://user:secret@db/app");
  }

  @Test
  void samePlaintextEncryptsDifferentlyEachTime() {
    assertThat(encryption.encrypt("same")).isNotEqualTo(encryption.encrypt("same"));
  }

  @Test
  void detectsTampering() {
    byte[] ciphertext = encryption.encrypt("secret");
    ciphertext[ciphertext.length - 1] ^= 1;
    assertThatThrownBy(() -> encryption.decrypt(ciphertext))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void refusesKeysOfTheWrongLength() {
    assertThatThrownBy(
            () ->
                new EncryptionService(
                    new CryptoProperties(Base64.getEncoder().encodeToString(new byte[16]))))
        .isInstanceOf(IllegalStateException.class);
  }
}
