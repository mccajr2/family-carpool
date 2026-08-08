package com.yourorg.quickapp.family;

import com.yourorg.quickapp.family.internal.FamilyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class FamilyExceptionHandler {

    @ExceptionHandler(FamilyException.class)
    ResponseEntity<ErrorResponse> handleFamily(FamilyException ex) {
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
