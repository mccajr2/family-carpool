package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.calendar.internal.CalendarException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class CalendarExceptionHandler {

    @ExceptionHandler(CalendarException.class)
    ResponseEntity<ErrorResponse> handleCalendar(CalendarException ex) {
        return ResponseEntity.status(ex.status()).body(new ErrorResponse(ex.getMessage()));
    }
}
