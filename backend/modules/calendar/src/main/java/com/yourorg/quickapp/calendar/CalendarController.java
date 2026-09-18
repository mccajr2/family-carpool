package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.internal.CalendarService;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.leaveby.CalendarRouteLeg;
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

    @GetMapping("/{source}/{itemId}/route")
    public CalendarRouteResponse getRoute(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @RequestParam(value = "leg", required = false, defaultValue = "TO")
                    CalendarRouteLeg leg,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.getRoute(adult, source, itemId, leg);
    }

    @PutMapping("/{source}/{itemId}/route")
    public CalendarRouteResponse reorderRoute(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @RequestParam(value = "leg", required = false, defaultValue = "TO")
                    CalendarRouteLeg leg,
            @Valid @RequestBody ReorderCalendarRouteRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.reorderRoute(adult, source, itemId, request.middleStopIds(), leg);
    }

    @PutMapping("/{source}/{itemId}/route/origin")
    public CalendarRouteResponse setRouteOrigin(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @RequestParam(value = "leg", required = false, defaultValue = "TO")
                    CalendarRouteLeg leg,
            @Valid @RequestBody SetCalendarLeaveFromRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.setRouteOrigin(
                adult,
                source,
                itemId,
                leg,
                request.leaveFromPlaceId(),
                request.leaveFromAddress());
    }

    @GetMapping("/{source}/{itemId}/playlist")
    public CalendarPlaylistResponse getPlaylist(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.getPlaylist(adult, source, itemId);
    }

    @PostMapping("/{source}/{itemId}/playlist/open")
    public CalendarPlaylistOpenResponse openPlaylist(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @RequestBody(required = false) OpenCalendarPlaylistRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        List<String> trackUris = request == null ? null : request.trackUris();
        return calendarService.openPlaylist(adult, source, itemId, trackUris);
    }

    @PutMapping("/{source}/{itemId}/leave-from")
    public CalendarItemResponse setLeaveFrom(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @Valid @RequestBody SetCalendarLeaveFromRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.setLeaveFrom(
                adult, source, itemId, request.leaveFromPlaceId(), request.leaveFromAddress());
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

    @PutMapping("/{source}/{itemId}/rsvps/{kidId}")
    public CalendarItemResponse setRsvp(
            @PathVariable("source") CalendarItemSource source,
            @PathVariable("itemId") UUID itemId,
            @PathVariable("kidId") UUID kidId,
            @Valid @RequestBody SetCalendarRsvpRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.setRsvp(adult, source, itemId, kidId, request.status());
    }

    @PutMapping("/coverages/{assignmentId}")
    public CalendarItemResponse reassignCoverage(
            @PathVariable("assignmentId") UUID assignmentId,
            @Valid @RequestBody AssignCalendarCoverageRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.reassignCoverage(adult, assignmentId, request);
    }

    @PutMapping("/coverages/{assignmentId}/leave-from")
    public CalendarItemResponse setCoverageLeaveFrom(
            @PathVariable("assignmentId") UUID assignmentId,
            @Valid @RequestBody SetCalendarLeaveFromRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.setCoverageLeaveFrom(
                adult, assignmentId, request.leaveFromPlaceId(), request.leaveFromAddress());
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

    @PutMapping("/drive-block-overrides")
    public List<CalendarItemResponse> setDriveBlockOverride(
            @Valid @RequestBody SetDriveBlockOverrideRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.setDriveBlockOverride(adult, request);
    }

    @DeleteMapping("/drive-block-overrides")
    public List<CalendarItemResponse> clearDriveBlockOverride(
            @RequestParam("leg") CarpoolLegKind leg,
            @RequestParam("leftSource") CalendarItemSource leftSource,
            @RequestParam("leftItemId") UUID leftItemId,
            @RequestParam("rightSource") CalendarItemSource rightSource,
            @RequestParam("rightItemId") UUID rightItemId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return calendarService.clearDriveBlockOverride(
                adult,
                new ClearDriveBlockOverrideRequest(
                        leg, leftSource, leftItemId, rightSource, rightItemId));
    }
}
