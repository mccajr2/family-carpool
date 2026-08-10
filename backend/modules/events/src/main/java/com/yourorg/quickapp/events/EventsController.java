package com.yourorg.quickapp.events;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.events.internal.EventsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/family/circle/events")
public class EventsController {

    private final AdultSessionApi adultSessionApi;
    private final EventsService eventsService;

    public EventsController(AdultSessionApi adultSessionApi, EventsService eventsService) {
        this.adultSessionApi = adultSessionApi;
        this.eventsService = eventsService;
    }

    @GetMapping
    public List<ManualEventResponse> list(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return eventsService.list(adult);
    }

    @GetMapping("/{eventId}")
    public ManualEventResponse get(
            @PathVariable("eventId") UUID eventId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return eventsService.get(adult, eventId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ManualEventResponse create(
            @Valid @RequestBody CreateManualEventRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return eventsService.create(adult, request);
    }

    @PutMapping("/{eventId}")
    public ManualEventResponse update(
            @PathVariable("eventId") UUID eventId,
            @Valid @RequestBody UpdateManualEventRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return eventsService.update(adult, eventId, request);
    }

    @DeleteMapping("/{eventId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("eventId") UUID eventId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        eventsService.delete(adult, eventId);
    }
}
