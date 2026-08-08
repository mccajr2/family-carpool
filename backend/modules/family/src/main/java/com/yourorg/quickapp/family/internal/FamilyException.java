package com.yourorg.quickapp.family.internal;

import org.springframework.http.HttpStatus;

public class FamilyException extends RuntimeException {

    private final HttpStatus status;

    public FamilyException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
