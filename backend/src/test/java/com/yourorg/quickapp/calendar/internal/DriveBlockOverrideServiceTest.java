package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.calendar.CalendarItemSource;
import com.yourorg.quickapp.calendar.DriveBlockOverrideAction;
import com.yourorg.quickapp.calendar.DriveBlockOverrideDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class DriveBlockOverrideServiceTest {

    @Mock
    private DriveBlockOverrideRepository repository;

    @InjectMocks
    private DriveBlockOverrideService service;

    private final UUID adultId = UUID.randomUUID();
    private final UUID leftId = UUID.randomUUID();
    private final UUID rightId = UUID.randomUUID();

    @Test
    void upsertInsertsNewOverrideWithCreatedAt() {
        when(repository
                        .findByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                                adultId,
                                CarpoolLegKind.TO,
                                CalendarItemSource.FEED,
                                leftId,
                                CalendarItemSource.FEED,
                                rightId))
                .thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DriveBlockOverrideDto saved =
                service.upsert(
                        adultId,
                        CarpoolLegKind.TO,
                        CalendarItemSource.FEED,
                        leftId,
                        CalendarItemSource.FEED,
                        rightId,
                        DriveBlockOverrideAction.FORCE_MERGE);

        ArgumentCaptor<DriveBlockOverrideEntity> captor =
                ArgumentCaptor.forClass(DriveBlockOverrideEntity.class);
        verify(repository).save(captor.capture());
        DriveBlockOverrideEntity entity = captor.getValue();
        assertThat(entity.adultId()).isEqualTo(adultId);
        assertThat(entity.leg()).isEqualTo(CarpoolLegKind.TO);
        assertThat(entity.action()).isEqualTo(DriveBlockOverrideAction.FORCE_MERGE);
        assertThat(entity.createdAt()).isNotNull();
        assertThat(saved.createdAt()).isEqualTo(entity.createdAt());
    }

    @Test
    void upsertUpdatesActionAndRefreshesCreatedAt() {
        Instant oldCreated = Instant.parse("2026-01-01T00:00:00Z");
        DriveBlockOverrideEntity existing =
                new DriveBlockOverrideEntity(
                        UUID.randomUUID(),
                        adultId,
                        CarpoolLegKind.TO,
                        CalendarItemSource.FEED,
                        leftId,
                        CalendarItemSource.FEED,
                        rightId,
                        DriveBlockOverrideAction.FORCE_MERGE,
                        oldCreated);
        when(repository
                        .findByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                                eq(adultId),
                                eq(CarpoolLegKind.TO),
                                eq(CalendarItemSource.FEED),
                                eq(leftId),
                                eq(CalendarItemSource.FEED),
                                eq(rightId)))
                .thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DriveBlockOverrideDto saved =
                service.upsert(
                        adultId,
                        CarpoolLegKind.TO,
                        CalendarItemSource.FEED,
                        leftId,
                        CalendarItemSource.FEED,
                        rightId,
                        DriveBlockOverrideAction.FORCE_SPLIT);

        assertThat(saved.action()).isEqualTo(DriveBlockOverrideAction.FORCE_SPLIT);
        assertThat(saved.createdAt()).isAfter(oldCreated);
        verify(repository).save(existing);
    }

    @Test
    void clearDeletesMatchingPair() {
        when(repository
                        .deleteByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                                adultId,
                                CarpoolLegKind.FROM,
                                CalendarItemSource.MANUAL,
                                leftId,
                                CalendarItemSource.FEED,
                                rightId))
                .thenReturn(1L);

        assertThat(
                        service.clear(
                                adultId,
                                CarpoolLegKind.FROM,
                                CalendarItemSource.MANUAL,
                                leftId,
                                CalendarItemSource.FEED,
                                rightId))
                .isTrue();
    }

    @Test
    void clearReturnsFalseWhenNothingStored() {
        when(repository
                        .deleteByAdultIdAndLegAndLeftItemSourceAndLeftItemIdAndRightItemSourceAndRightItemId(
                                any(), any(), any(), any(), any(), any()))
                .thenReturn(0L);

        assertThat(
                        service.clear(
                                adultId,
                                CarpoolLegKind.TO,
                                CalendarItemSource.FEED,
                                leftId,
                                CalendarItemSource.FEED,
                                rightId))
                .isFalse();
    }

    @Test
    void rejectsIdenticalLeftAndRight() {
        assertThatThrownBy(
                        () ->
                                service.upsert(
                                        adultId,
                                        CarpoolLegKind.TO,
                                        CalendarItemSource.FEED,
                                        leftId,
                                        CalendarItemSource.FEED,
                                        leftId,
                                        DriveBlockOverrideAction.FORCE_MERGE))
                .isInstanceOf(CalendarException.class)
                .satisfies(
                        ex ->
                                assertThat(((CalendarException) ex).status())
                                        .isEqualTo(HttpStatus.BAD_REQUEST));
        verify(repository, never()).save(any());
    }

    @Test
    void listForAdultMapsEntities() {
        DriveBlockOverrideEntity row =
                new DriveBlockOverrideEntity(
                        UUID.randomUUID(),
                        adultId,
                        CarpoolLegKind.TO,
                        CalendarItemSource.FEED,
                        leftId,
                        CalendarItemSource.FEED,
                        rightId,
                        DriveBlockOverrideAction.FORCE_SPLIT,
                        Instant.parse("2026-09-15T12:00:00Z"));
        when(repository.findByAdultIdOrderByCreatedAtAsc(adultId)).thenReturn(List.of(row));

        List<DriveBlockOverrideDto> listed = service.listForAdult(adultId);
        assertThat(listed).singleElement().satisfies(dto -> {
            assertThat(dto.action()).isEqualTo(DriveBlockOverrideAction.FORCE_SPLIT);
            assertThat(dto.leftItemId()).isEqualTo(leftId);
            assertThat(dto.rightItemId()).isEqualTo(rightId);
        });

        List<DrivingBlockComputer.PairOverride> pairs = service.pairOverridesForAdult(adultId);
        assertThat(pairs).singleElement().satisfies(pair -> {
            assertThat(pair.action()).isEqualTo(DriveBlockOverrideAction.FORCE_SPLIT);
            assertThat(pair.leg()).isEqualTo(CarpoolLegKind.TO);
        });
    }
}
