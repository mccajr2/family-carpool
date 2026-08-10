package com.yourorg.quickapp.events.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.events.CreateManualEventRequest;
import com.yourorg.quickapp.events.UpdateManualEventRequest;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class EventsServiceTest {

    @Mock
    private FamilyMembershipApi familyMembershipApi;

    @Mock
    private ManualEventRepository events;

    @InjectMocks
    private EventsService eventsService;

    @Test
    void createPersistsEventForAnyMember() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        Instant start = Instant.parse("2026-08-15T17:00:00Z");
        Instant end = Instant.parse("2026-08-15T18:00:00Z");

        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response =
                eventsService.create(
                        adult,
                        new CreateManualEventRequest(
                                " Dentist ", start, end, " Clinic ", List.of(kidId)));

        assertThat(response.title()).isEqualTo("Dentist");
        assertThat(response.startsAt()).isEqualTo(start);
        assertThat(response.endsAt()).isEqualTo(end);
        assertThat(response.location()).isEqualTo("Clinic");
        assertThat(response.kidIds()).containsExactly(kidId);

        ArgumentCaptor<ManualEventEntity> saved = ArgumentCaptor.forClass(ManualEventEntity.class);
        verify(events).save(saved.capture());
        assertThat(saved.getValue().circleId()).isEqualTo(circleId);
        assertThat(saved.getValue().kidIds()).isEqualTo(Set.of(kidId));
        verify(familyMembershipApi).requireKidsInCircle(circleId, Set.of(kidId));
    }

    @Test
    void createRejectsEmptyKidIds() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);

        assertThatThrownBy(
                        () ->
                                eventsService.create(
                                        adult,
                                        new CreateManualEventRequest(
                                                "Game",
                                                Instant.parse("2026-08-15T17:00:00Z"),
                                                null,
                                                null,
                                                List.of())))
                .isInstanceOf(EventsException.class)
                .extracting(ex -> ((EventsException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(familyMembershipApi, never()).requireKidsInCircle(any(), any());
        verify(events, never()).save(any());
    }

    @Test
    void createRejectsEndsAtBeforeStartsAt() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "c@example.com", "Care");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);

        assertThatThrownBy(
                        () ->
                                eventsService.create(
                                        adult,
                                        new CreateManualEventRequest(
                                                "Game",
                                                Instant.parse("2026-08-15T18:00:00Z"),
                                                Instant.parse("2026-08-15T17:00:00Z"),
                                                null,
                                                List.of(kidId))))
                .isInstanceOf(EventsException.class)
                .satisfies(
                        ex -> {
                            EventsException eventsEx = (EventsException) ex;
                            assertThat(eventsEx.status()).isEqualTo(HttpStatus.BAD_REQUEST);
                            assertThat(eventsEx.getMessage()).contains("endsAt");
                        });
        verify(events, never()).save(any());
    }

    @Test
    void listOrdersByStartsAt() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ManualEventEntity later =
                new ManualEventEntity(
                        UUID.randomUUID(),
                        circleId,
                        "Later",
                        Instant.parse("2026-08-16T10:00:00Z"),
                        null,
                        null,
                        Instant.now());
        later.setKidIds(Set.of(kidId));
        ManualEventEntity earlier =
                new ManualEventEntity(
                        UUID.randomUUID(),
                        circleId,
                        "Earlier",
                        Instant.parse("2026-08-15T10:00:00Z"),
                        null,
                        null,
                        Instant.now());
        earlier.setKidIds(Set.of(kidId));

        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(events.findByCircleIdOrderByStartsAtAscIdAsc(circleId))
                .thenReturn(List.of(earlier, later));

        var listed = eventsService.list(adult);

        assertThat(listed).extracting(r -> r.title()).containsExactly("Earlier", "Later");
    }

    @Test
    void updateNotFound() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(events.findByIdAndCircleId(eventId, circleId)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                eventsService.update(
                                        adult,
                                        eventId,
                                        new UpdateManualEventRequest(
                                                "X",
                                                Instant.parse("2026-08-15T17:00:00Z"),
                                                null,
                                                null,
                                                List.of(UUID.randomUUID()))))
                .isInstanceOf(EventsException.class)
                .extracting(ex -> ((EventsException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void caregiverCanCreateWhenMembershipAllows() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "c@example.com", "Care");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response =
                eventsService.create(
                        adult,
                        new CreateManualEventRequest(
                                "School concert",
                                Instant.parse("2026-09-01T23:00:00Z"),
                                null,
                                null,
                                List.of(kidId)));

        assertThat(response.title()).isEqualTo("School concert");
        verify(familyMembershipApi).requireMemberCircleId(adultId);
        verify(familyMembershipApi, never()).requireOrganizerCircleId(any());
    }

    @Test
    void createPropagatesInvalidKid() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        org.mockito.Mockito.doThrow(
                        new FamilyAccessException(HttpStatus.BAD_REQUEST, "Kid not found in this circle"))
                .when(familyMembershipApi)
                .requireKidsInCircle(eq(circleId), eq(Set.of(kidId)));

        assertThatThrownBy(
                        () ->
                                eventsService.create(
                                        adult,
                                        new CreateManualEventRequest(
                                                "Game",
                                                Instant.parse("2026-08-15T17:00:00Z"),
                                                null,
                                                null,
                                                List.of(kidId))))
                .isInstanceOf(FamilyAccessException.class);
        verify(events, never()).save(any());
    }

    @Test
    void deleteRemovesEvent() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        ManualEventEntity event =
                new ManualEventEntity(
                        eventId,
                        circleId,
                        "Dentist",
                        Instant.parse("2026-08-15T17:00:00Z"),
                        null,
                        null,
                        Instant.now());
        event.setKidIds(Set.of(kidId));
        when(familyMembershipApi.requireMemberCircleId(adultId)).thenReturn(circleId);
        when(events.findByIdAndCircleId(eventId, circleId)).thenReturn(Optional.of(event));

        eventsService.delete(adult, eventId);

        verify(events).delete(event);
    }
}
