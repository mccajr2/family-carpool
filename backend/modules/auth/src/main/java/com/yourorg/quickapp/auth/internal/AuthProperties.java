package com.yourorg.quickapp.auth.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        int codeLength,
        int codeTtlSeconds,
        String codePepper,
        int sessionTtlSeconds,
        int requestCodeLimit,
        int requestCodeWindowSeconds,
        int verifyCodeLimit,
        int verifyCodeWindowSeconds,
        boolean devCodeEcho) {}
