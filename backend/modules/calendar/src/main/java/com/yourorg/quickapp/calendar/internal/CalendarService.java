package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CalendarService {

    private final FamilyMembershipApi familyMembershipApi;
    private final FeedCalendarApi feedCalendarApi;
    private final ManualEventCalendarApi manualEventCalendarApi;

    public CalendarService(
            FamilyMembershipApi familyMembershipApi,
            FeedCalendarApi feedCalendarApi,
            ManualEventCalendarApi manualEventCalendarApi) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedCalendarApi = feedCalendarApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
    }

    public List<CalendarItemResponse> list(AdultResponse adult, Instant from, Instant to) {
        requireValidRange(from, to);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());

        List<CalendarItemResponse> items = new ArrayList<>();
        for (FeedCalendarEventDto feedEvent : feedCalendarApi.listEventsInRange(circleId, from, to)) {
            items.add(fromFeed(feedEvent));
        }
        for (ManualCalendarEventDto manual :
                manualEventCalendarApi.listInRange(circleId, from, to)) {
            items.add(fromManual(manual));
        }

        items.sort(
                Comparator.comparing(CalendarItemResponse::startsAt)
                        .thenComparing(item -> item.source().name())
                        .thenComparing(CalendarItemResponse::id));
        return List.copyOf(items);
    }

    private static void requireValidRange(Instant from, Instant to) {
        if (from == null || to == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (!from.isBefore(to)) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from must be before to");
        }
    }

    private static CalendarItemResponse fromFeed(FeedCalendarEventDto event) {
        return new CalendarItemResponse(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                event.feedId(),
                event.feedName());
    }

    private static CalendarItemResponse fromManual(ManualCalendarEventDto event) {
        return new CalendarItemResponse(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                null,
                null);
    }
}
