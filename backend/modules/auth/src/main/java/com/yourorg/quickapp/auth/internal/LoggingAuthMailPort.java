package com.yourorg.quickapp.auth.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
class LoggingAuthMailPort implements AuthMailPort {

    private static final Logger log = LoggerFactory.getLogger(LoggingAuthMailPort.class);

    @Override
    public void sendSignInCode(String email, String code) {
        log.info("Dev auth mail: sign-in code for {} is {}", email, code);
    }
}
