package com.yourorg.quickapp.auth.internal;

import com.yourorg.quickapp.auth.internal.AuthProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
class AuthConfiguration {}
