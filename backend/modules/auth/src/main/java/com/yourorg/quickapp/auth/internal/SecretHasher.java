package com.yourorg.quickapp.auth.internal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
class SecretHasher {

    private final SecureRandom secureRandom = new SecureRandom();
    private final String pepper;

    SecretHasher(AuthProperties properties) {
        this.pepper = properties.codePepper();
    }

    String hash(String plaintext) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(pepper.getBytes(StandardCharsets.UTF_8));
            byte[] hashed = digest.digest(plaintext.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    String newOpaqueToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    String newNumericCode(int length) {
        StringBuilder code = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            code.append(secureRandom.nextInt(10));
        }
        return code.toString();
    }
}
