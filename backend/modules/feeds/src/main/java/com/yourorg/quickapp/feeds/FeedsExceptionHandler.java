package com.yourorg.quickapp.feeds;

import com.yourorg.quickapp.feeds.internal.FeedsException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class FeedsExceptionHandler {

    @ExceptionHandler(FeedsException.class)
    ResponseEntity<ErrorResponse> handleFeeds(FeedsException ex) {
        return ResponseEntity.status(ex.status()).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message =
                ex.getBindingResult().getFieldErrors().stream()
                        .findFirst()
                        .map(err -> err.getField() + " " + err.getDefaultMessage())
                        .orElse("Invalid request");
        return ResponseEntity.badRequest().body(new ErrorResponse(message));
    }
}
