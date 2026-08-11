package com.yourorg.quickapp.events.internal;

import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ManualEventCalendarApiImpl implements ManualEventCalendarApi {

    private final ManualEventRepository events;

    ManualEventCalendarApiImpl(ManualEventRepository events) {
        this.events = events;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManualCalendarEventDto> listInRange(UUID circleId, Instant from, Instant to) {
        return events
                .findByCircleIdAndStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAscIdAsc(
                        circleId, from, to)
                .stream()
                .map(ManualEventCalendarApiImpl::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ManualCalendarEventDto> findInCircle(UUID circleId, UUID itemId) {
        return events.findByIdAndCircleId(itemId, circleId).map(ManualEventCalendarApiImpl::toDto);
    }

    private static ManualCalendarEventDto toDto(ManualEventEntity event) {
        return new ManualCalendarEventDto(
                event.id(),
                event.title(),
                event.startsAt(),
                event.endsAt(),
                event.location(),
                List.copyOf(event.kidIds()));
    }
}
