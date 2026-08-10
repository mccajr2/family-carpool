package com.yourorg.quickapp.events.internal;

import org.springframework.http.HttpStatus;

public class EventsException extends RuntimeException {

    private final HttpStatus status;

    public EventsException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
