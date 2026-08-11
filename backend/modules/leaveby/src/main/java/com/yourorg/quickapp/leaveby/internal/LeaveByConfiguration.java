package com.yourorg.quickapp.leaveby.internal;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(LeaveByProperties.class)
class LeaveByConfiguration {}
