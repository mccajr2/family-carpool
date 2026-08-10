package com.yourorg.quickapp.calendar.internal;

import org.springframework.http.HttpStatus;

public class CalendarException extends RuntimeException {

    private final HttpStatus status;

    public CalendarException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
