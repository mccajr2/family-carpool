package com.yourorg.quickapp.carpool;

import com.yourorg.quickapp.carpool.internal.CarpoolException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class CarpoolExceptionHandler {

    @ExceptionHandler(CarpoolException.class)
    ResponseEntity<ErrorResponse> handleCarpool(CarpoolException ex) {
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
