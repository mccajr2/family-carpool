package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.calendar.internal.CalendarService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
}
