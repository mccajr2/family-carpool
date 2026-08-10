package com.yourorg.quickapp.feeds.internal;

import org.springframework.http.HttpStatus;

public class FeedsException extends RuntimeException {

    private final HttpStatus status;

    public FeedsException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
