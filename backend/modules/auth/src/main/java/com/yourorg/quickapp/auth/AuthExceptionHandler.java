package com.yourorg.quickapp.auth;

import com.yourorg.quickapp.auth.internal.AuthException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {

    @ExceptionHandler(AuthException.class)
    ResponseEntity<ErrorResponse> handleAuth(AuthException ex) {
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
