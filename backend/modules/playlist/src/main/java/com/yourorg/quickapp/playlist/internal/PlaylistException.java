package com.yourorg.quickapp.playlist.internal;

import org.springframework.http.HttpStatus;

public class PlaylistException extends RuntimeException {

    private final HttpStatus status;

    public PlaylistException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
