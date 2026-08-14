package com.yourorg.quickapp.carpool.internal;

import org.springframework.http.HttpStatus;

public class CarpoolException extends RuntimeException {

    private final HttpStatus status;

    public CarpoolException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
