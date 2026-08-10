package com.yourorg.quickapp.family;

import org.springframework.http.HttpStatus;

/** Thrown by {@link FamilyMembershipApi} for authz / validation failures. */
public class FamilyAccessException extends RuntimeException {

    private final HttpStatus status;

    public FamilyAccessException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
