package com.yourorg.quickapp.playlist.internal;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * AES-256-GCM for Spotify tokens at rest. Ciphertext wire format is Base64 of
 * {@code iv (12 bytes) || ciphertext+tag}.
 */
@Component
class TokenEncryptor {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private static final int KEY_LENGTH_BYTES = 32;

    private final SecretKey key;
    private final SecureRandom secureRandom = new SecureRandom();

    TokenEncryptor(SpotifyProperties properties) {
        byte[] keyBytes = properties.tokenEncryptionKey().getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length != KEY_LENGTH_BYTES) {
            throw new IllegalStateException(
                    "app.spotify.token-encryption-key must be exactly "
                            + KEY_LENGTH_BYTES
                            + " UTF-8 bytes (was "
                            + keyBytes.length
                            + ")");
        }
        this.key = new SecretKeySpec(keyBytes, "AES");
    }

    String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
            buffer.put(iv);
            buffer.put(ciphertext);
            return Base64.getEncoder().encodeToString(buffer.array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to encrypt Spotify token", e);
        }
    }

    String decrypt(String ciphertextBase64) {
        try {
            byte[] combined = Base64.getDecoder().decode(ciphertextBase64);
            if (combined.length <= IV_LENGTH_BYTES) {
                throw new IllegalArgumentException("Ciphertext too short");
            }
            byte[] iv = new byte[IV_LENGTH_BYTES];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH_BYTES];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH_BYTES);
            System.arraycopy(combined, IV_LENGTH_BYTES, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Failed to decrypt Spotify token", e);
        }
    }
}
