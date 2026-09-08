package com.yourorg.quickapp.playlist;

import com.yourorg.quickapp.playlist.internal.PlaylistException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class PlaylistExceptionHandler {

    @ExceptionHandler(PlaylistException.class)
    ResponseEntity<ErrorResponse> handlePlaylist(PlaylistException ex) {
        return ResponseEntity.status(ex.status()).body(new ErrorResponse(ex.getMessage()));
    }
}
