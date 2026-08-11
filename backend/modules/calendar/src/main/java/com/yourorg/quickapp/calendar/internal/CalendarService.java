package com.yourorg.quickapp.calendar.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.calendar.CalendarItemResponse;
import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import com.yourorg.quickapp.feeds.FeedCalendarEventDto;
import com.yourorg.quickapp.leaveby.LeaveByApi;
import com.yourorg.quickapp.leaveby.LeaveByEnrichmentDto;
import com.yourorg.quickapp.leaveby.LeaveByItemSource;
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
    private final LeaveByApi leaveByApi;

    public CalendarService(
            FamilyMembershipApi familyMembershipApi,
            FeedCalendarApi feedCalendarApi,
            ManualEventCalendarApi manualEventCalendarApi,
            LeaveByApi leaveByApi) {
        this.familyMembershipApi = familyMembershipApi;
        this.feedCalendarApi = feedCalendarApi;
        this.manualEventCalendarApi = manualEventCalendarApi;
        this.leaveByApi = leaveByApi;
    }

    public List<CalendarItemResponse> list(AdultResponse adult, Instant from, Instant to) {
        requireValidRange(from, to);
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());

        List<CalendarItemResponse> items = new ArrayList<>();
        for (FeedCalendarEventDto feedEvent : feedCalendarApi.listEventsInRange(circleId, from, to)) {
            items.add(fromFeed(adult.id(), feedEvent));
        }
        for (ManualCalendarEventDto manual :
                manualEventCalendarApi.listInRange(circleId, from, to)) {
            items.add(fromManual(adult.id(), manual));
        }

        items.sort(
                Comparator.comparing(CalendarItemResponse::startsAt)
                        .thenComparing(item -> item.source().name())
                        .thenComparing(CalendarItemResponse::id));
        return List.copyOf(items);
    }

    public CalendarItemResponse setLeaveFrom(
            AdultResponse adult, CalendarItemSource source, UUID itemId, UUID placeId) {
        UUID circleId = familyMembershipApi.requireMemberCircleId(adult.id());
        leaveByApi.setLeaveFrom(adult.id(), toLeaveBySource(source), itemId, placeId);
        return switch (source) {
            case MANUAL ->
                    manualEventCalendarApi
                            .findInCircle(circleId, itemId)
                            .map(event -> fromManual(adult.id(), event))
                            .orElseThrow(
                                    () ->
                                            new CalendarException(
                                                    HttpStatus.NOT_FOUND, "Calendar item not found"));
            case FEED ->
                    feedCalendarApi
                            .findEventInCircle(circleId, itemId)
                            .map(event -> fromFeed(adult.id(), event))
                            .orElseThrow(
                                    () ->
                                            new CalendarException(
                                                    HttpStatus.NOT_FOUND, "Calendar item not found"));
        };
    }

    private static void requireValidRange(Instant from, Instant to) {
        if (from == null || to == null) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from and to are required");
        }
        if (!from.isBefore(to)) {
            throw new CalendarException(HttpStatus.BAD_REQUEST, "from must be before to");
        }
    }

    private CalendarItemResponse fromFeed(UUID adultId, FeedCalendarEventDto event) {
        LeaveByEnrichmentDto leaveBy =
                leaveByApi.enrich(
                        adultId,
                        LeaveByItemSource.FEED,
                        event.id(),
                        event.startsAt(),
                        event.location());
        return new CalendarItemResponse(
                event.id(),
                CalendarItemSource.FEED,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                event.feedId(),
                event.feedName(),
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason());
    }

    private CalendarItemResponse fromManual(UUID adultId, ManualCalendarEventDto event) {
        LeaveByEnrichmentDto leaveBy =
                leaveByApi.enrich(
                        adultId,
                        LeaveByItemSource.MANUAL,
                        event.id(),
                        event.startsAt(),
                        event.location());
        return new CalendarItemResponse(
                event.id(),
                CalendarItemSource.MANUAL,
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                event.kidIds(),
                null,
                null,
                leaveBy.leaveFromPlaceId(),
                leaveBy.leaveFromPlaceName(),
                leaveBy.leaveByAt(),
                leaveBy.leaveByStatus(),
                leaveBy.leaveByReason());
    }

    private static LeaveByItemSource toLeaveBySource(CalendarItemSource source) {
        return switch (source) {
            case MANUAL -> LeaveByItemSource.MANUAL;
            case FEED -> LeaveByItemSource.FEED;
        };
    }
}
