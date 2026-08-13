package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.internal.CalendarService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/family/circle/calendar")
public class CalendarController {

    private final AdultSessionApi adultSessionApi;
    private final CalendarService calendarService;

    public CalendarController(AdultSessionApi adultSessionApi, CalendarService calendarService) {
        this.adultSessionApi = adultSessionApi;
        this.calendarService = calendarService;
    }

    @GetMapping
    public List<CalendarItemResponse> list(
            @RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.list(adult, from, to);
    }

    @GetMapping("/leave-by")
    public List<CalendarLeaveByResponse> listLeaveBy(
            @RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.listLeaveBy(adult, from, to);
    }

    @PutMapping("/{source}/{itemId}/leave-from")
    public CalendarItemResponse setLeaveFrom(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @Valid @RequestBody SetCalendarLeaveFromRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.setLeaveFrom(adult, source, itemId, request.leaveFromPlaceId());
    }

    @PostMapping("/{source}/{itemId}/coverages")
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarItemResponse assignCoverage(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @Valid @RequestBody AssignCalendarCoverageRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.assignCoverage(adult, source, itemId, request);
    }

    @PutMapping("/coverages/{assignmentId}")
    public CalendarItemResponse reassignCoverage(
            @PathVariable("assignmentId") UUID assignmentId,
            @Valid @RequestBody AssignCalendarCoverageRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.reassignCoverage(adult, assignmentId, request);
    }

    @DeleteMapping("/coverages/{assignmentId}")
    public CalendarItemResponse removeCoverage(
            @PathVariable("assignmentId") UUID assignmentId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.removeCoverage(adult, assignmentId);
    }

    @PostMapping("/coverages/{assignmentId}/confirm")
    public CalendarItemResponse confirmCoverage(
            @PathVariable("assignmentId") UUID assignmentId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.confirmCoverage(adult, assignmentId);
    }

    @PostMapping("/coverages/{assignmentId}/decline")
    public CalendarItemResponse declineCoverage(
            @PathVariable("assignmentId") UUID assignmentId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.declineCoverage(adult, assignmentId);
    }
}
