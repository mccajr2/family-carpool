package com.yourorg.quickapp.rsvp.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.rsvp.RsvpDto;
import com.yourorg.quickapp.rsvp.RsvpItemSource;
import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RsvpApiImplTest {

    @Mock
    private RsvpRepository rsvps;

    private RsvpApiImpl api;

    private final UUID circleId = UUID.randomUUID();
    private final UUID itemId = UUID.randomUUID();
    private final UUID kidA = UUID.randomUUID();
    private final UUID kidB = UUID.randomUUID();
    private final UUID adultId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        api = new RsvpApiImpl(rsvps);
    }

    @Test
    void listForItemsReturnsStoredRowsOnly() {
        when(rsvps.findByCircleIdAndItemSourceAndItemIdIn(
                        circleId, RsvpItemSource.MANUAL, List.of(itemId)))
                .thenReturn(List.of(entity(kidA, RsvpStatus.YES)));

        List<RsvpDto> result = api.listForItems(circleId, RsvpItemSource.MANUAL, List.of(itemId));

        assertThat(result).containsExactly(new RsvpDto(RsvpItemSource.MANUAL, itemId, kidA, RsvpStatus.YES));
    }

    @Test
    void listForItemsEmptyIdsIsEmpty() {
        assertThat(api.listForItems(circleId, RsvpItemSource.FEED, List.of())).isEmpty();
        verify(rsvps, never()).findByCircleIdAndItemSourceAndItemIdIn(any(), any(), any());
    }

    @Test
    void statusesForKidsMaterializesNoResponse() {
        when(rsvps.findByCircleIdAndItemSourceAndItemId(circleId, RsvpItemSource.MANUAL, itemId))
                .thenReturn(List.of(entity(kidA, RsvpStatus.NO)));

        List<RsvpDto> result =
                api.statusesForKids(
                        circleId, RsvpItemSource.MANUAL, itemId, List.of(kidA, kidB));

        assertThat(result)
                .containsExactly(
                        new RsvpDto(RsvpItemSource.MANUAL, itemId, kidA, RsvpStatus.NO),
                        new RsvpDto(RsvpItemSource.MANUAL, itemId, kidB, RsvpStatus.NO_RESPONSE));
    }

    @Test
    void setStatusYesInsertsWhenMissing() {
        when(rsvps.findByCircleIdAndItemSourceAndItemIdAndKidId(
                        circleId, RsvpItemSource.MANUAL, itemId, kidA))
                .thenReturn(Optional.empty());
        when(rsvps.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RsvpDto result =
                api.setStatus(
                        circleId,
                        RsvpItemSource.MANUAL,
                        itemId,
                        kidA,
                        RsvpStatus.YES,
                        adultId);

        assertThat(result.status()).isEqualTo(RsvpStatus.YES);
        ArgumentCaptor<RsvpEntity> captor = ArgumentCaptor.forClass(RsvpEntity.class);
        verify(rsvps).save(captor.capture());
        assertThat(captor.getValue().kidId()).isEqualTo(kidA);
        assertThat(captor.getValue().status()).isEqualTo(RsvpStatus.YES);
        assertThat(captor.getValue().updatedByAdultId()).isEqualTo(adultId);
    }

    @Test
    void setStatusNoUpdatesExisting() {
        RsvpEntity existing = entity(kidA, RsvpStatus.YES);
        when(rsvps.findByCircleIdAndItemSourceAndItemIdAndKidId(
                        circleId, RsvpItemSource.FEED, itemId, kidA))
                .thenReturn(Optional.of(existing));
        when(rsvps.save(existing)).thenReturn(existing);

        RsvpDto result =
                api.setStatus(
                        circleId, RsvpItemSource.FEED, itemId, kidA, RsvpStatus.NO, adultId);

        assertThat(result.status()).isEqualTo(RsvpStatus.NO);
        assertThat(existing.status()).isEqualTo(RsvpStatus.NO);
        assertThat(existing.updatedByAdultId()).isEqualTo(adultId);
        verify(rsvps).save(existing);
        verify(rsvps, never()).delete(any());
    }

    @Test
    void setStatusNoResponseDeletesExistingRow() {
        RsvpEntity existing = entity(kidA, RsvpStatus.YES);
        when(rsvps.findByCircleIdAndItemSourceAndItemIdAndKidId(
                        circleId, RsvpItemSource.MANUAL, itemId, kidA))
                .thenReturn(Optional.of(existing));

        RsvpDto result =
                api.setStatus(
                        circleId,
                        RsvpItemSource.MANUAL,
                        itemId,
                        kidA,
                        RsvpStatus.NO_RESPONSE,
                        adultId);

        assertThat(result.status()).isEqualTo(RsvpStatus.NO_RESPONSE);
        verify(rsvps).delete(existing);
        verify(rsvps, never()).save(any());
    }

    @Test
    void setStatusNoResponseWhenMissingIsNoOp() {
        when(rsvps.findByCircleIdAndItemSourceAndItemIdAndKidId(
                        circleId, RsvpItemSource.MANUAL, itemId, kidA))
                .thenReturn(Optional.empty());

        RsvpDto result =
                api.setStatus(
                        circleId,
                        RsvpItemSource.MANUAL,
                        itemId,
                        kidA,
                        RsvpStatus.NO_RESPONSE,
                        adultId);

        assertThat(result.status()).isEqualTo(RsvpStatus.NO_RESPONSE);
        verify(rsvps, never()).delete(any());
        verify(rsvps, never()).save(any());
    }

    @Test
    void setStatusRejectsNullStatus() {
        assertThatThrownBy(
                        () ->
                                api.setStatus(
                                        circleId,
                                        RsvpItemSource.MANUAL,
                                        itemId,
                                        kidA,
                                        null,
                                        adultId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("status");
    }

    @Test
    void deleteForKidsNotOnItemRemovesDroppedKidsOnly() {
        RsvpEntity keep = entity(kidA, RsvpStatus.YES);
        RsvpEntity drop = entity(kidB, RsvpStatus.NO);
        when(rsvps.findByCircleIdAndItemSourceAndItemId(circleId, RsvpItemSource.MANUAL, itemId))
                .thenReturn(List.of(keep, drop));

        api.deleteForKidsNotOnItem(circleId, RsvpItemSource.MANUAL, itemId, List.of(kidA));

        verify(rsvps).delete(drop);
        verify(rsvps, never()).delete(keep);
    }

    @Test
    void deleteForKidsNotOnItemEmptyRemainingDeletesAll() {
        RsvpEntity row = entity(kidA, RsvpStatus.YES);
        when(rsvps.findByCircleIdAndItemSourceAndItemId(circleId, RsvpItemSource.FEED, itemId))
                .thenReturn(List.of(row));

        api.deleteForKidsNotOnItem(circleId, RsvpItemSource.FEED, itemId, List.of());

        verify(rsvps).delete(row);
    }

    private RsvpEntity entity(UUID kidId, RsvpStatus status) {
        Instant now = Instant.parse("2026-08-13T16:00:00Z");
        return new RsvpEntity(
                UUID.randomUUID(),
                circleId,
                RsvpItemSource.MANUAL,
                itemId,
                kidId,
                status,
                adultId,
                now,
                now);
    }
}
