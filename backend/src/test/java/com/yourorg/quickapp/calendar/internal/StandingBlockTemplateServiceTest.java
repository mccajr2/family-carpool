package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.calendar.StandingBlockMemberSnapshotDto;
import com.yourorg.quickapp.calendar.StandingBlockTemplateDto;
import com.yourorg.quickapp.calendar.StandingCoverageSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanLegSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRouteOriginSnapshotDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
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
class StandingBlockTemplateServiceTest {

    @Mock
    private StandingBlockTemplateRepository repository;

    @InjectMocks
    private StandingBlockTemplateService service;

    private final UUID circleId = UUID.randomUUID();
    private final UUID adultId = UUID.randomUUID();
    private final UUID kidId = UUID.randomUUID();
    private final UUID feedId = UUID.randomUUID();

    @Test
    void savePersistsOrderedFingerprintsAndSnapshots() {
        when(repository.findByCircleIdAndFingerprintSetKey(any(), any()))
                .thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        StandingBlockMemberSnapshotDto member =
                new StandingBlockMemberSnapshotDto(
                        fp,
                        0,
                        List.of(
                                new StandingCoverageSnapshotDto(
                                        adultId,
                                        adultId,
                                        CoverageStatus.CONFIRMED,
                                        List.of(kidId),
                                        null,
                                        null)),
                        List.of(
                                new StandingRidePlanSnapshotDto(
                                        List.of(kidId),
                                        List.of(
                                                new StandingRidePlanLegSnapshotDto(
                                                        CarpoolLegKind.TO,
                                                        CarpoolLegPhase.CONFIRMED,
                                                        adultId,
                                                        circleId,
                                                        null,
                                                        "Home",
                                                        "1 Main",
                                                        CarpoolMeetSide.REQUESTER),
                                                new StandingRidePlanLegSnapshotDto(
                                                        CarpoolLegKind.FROM,
                                                        CarpoolLegPhase.CONFIRMED,
                                                        adultId,
                                                        circleId,
                                                        null,
                                                        null,
                                                        null,
                                                        CarpoolMeetSide.REQUESTER)))),
                        List.of(
                                new StandingRouteOriginSnapshotDto(
                                        adultId,
                                        CarpoolLegKind.TO,
                                        null,
                                        null,
                                        "1 Main St")));

        StandingBlockTemplateDto saved = service.save(circleId, adultId, "America/New_York", List.of(member));

        ArgumentCaptor<StandingBlockTemplateEntity> captor =
                ArgumentCaptor.forClass(StandingBlockTemplateEntity.class);
        verify(repository).save(captor.capture());
        StandingBlockTemplateEntity entity = captor.getValue();
        assertThat(entity.circleId()).isEqualTo(circleId);
        assertThat(entity.fingerprintSetKey()).isEqualTo(fp.encoded());
        assertThat(entity.members()).hasSize(1);
        StandingBlockTemplateMemberEntity stored = entity.members().getFirst();
        assertThat(stored.feedId()).isEqualTo(feedId);
        assertThat(stored.dayOfWeek()).isEqualTo("TUESDAY");
        assertThat(stored.minuteOfDay()).isEqualTo(17 * 60);
        assertThat(StandingBlockSnapshotJson.readCoverages(stored.coveragesJson()))
                .singleElement()
                .satisfies(
                        c -> {
                            assertThat(c.coveringAdultId()).isEqualTo(adultId);
                            assertThat(c.status()).isEqualTo(CoverageStatus.CONFIRMED);
                            assertThat(c.kidIds()).containsExactly(kidId);
                        });
        assertThat(StandingBlockSnapshotJson.readRidePlans(stored.ridePlansJson())).hasSize(1);
        assertThat(StandingBlockSnapshotJson.readRouteOrigins(stored.routeOriginsJson()))
                .singleElement()
                .satisfies(o -> assertThat(o.leaveFromAddress()).isEqualTo("1 Main St"));
        assertThat(saved.members()).hasSize(1);
        assertThat(saved.members().getFirst().fingerprint()).isEqualTo(fp);
    }

    @Test
    void saveRejectsEmptyMembersAndDeclinedCoverage() {
        assertThatThrownBy(() -> service.save(circleId, adultId, "America/New_York", List.of()))
                .isInstanceOf(CalendarException.class)
                .satisfies(
                        ex ->
                                assertThat(((CalendarException) ex).status())
                                        .isEqualTo(HttpStatus.BAD_REQUEST));

        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.MONDAY, 8 * 60, "school");
        StandingBlockMemberSnapshotDto declined =
                new StandingBlockMemberSnapshotDto(
                        fp,
                        0,
                        List.of(
                                new StandingCoverageSnapshotDto(
                                        adultId,
                                        adultId,
                                        CoverageStatus.DECLINED,
                                        List.of(kidId),
                                        null,
                                        null)),
                        List.of(),
                        List.of());
        assertThatThrownBy(
                        () ->
                                service.save(
                                        circleId, adultId, "America/New_York", List.of(declined)))
                .isInstanceOf(CalendarException.class);
    }

    @Test
    void deleteByFingerprintsDelegatesToRepository() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        when(repository.deleteByCircleIdAndFingerprintSetKey(circleId, fp.encoded()))
                .thenReturn(1L);

        assertThat(service.deleteByFingerprints(circleId, List.of(fp))).isTrue();
        when(repository.deleteByCircleIdAndFingerprintSetKey(circleId, fp.encoded()))
                .thenReturn(0L);
        assertThat(service.deleteByFingerprints(circleId, List.of(fp))).isFalse();
    }

    @Test
    void findByCircleAndFingerprintsMapsEntity() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        StandingBlockTemplateEntity entity =
                new StandingBlockTemplateEntity(
                        UUID.randomUUID(),
                        circleId,
                        fp.encoded(),
                        adultId,
                        "America/New_York",
                        Instant.parse("2026-09-01T12:00:00Z"));
        entity.replaceMembers(
                List.of(
                        new StandingBlockTemplateMemberEntity(
                                UUID.randomUUID(),
                                0,
                                feedId,
                                "TUESDAY",
                                17 * 60,
                                "rink a",
                                fp.encoded(),
                                "[]",
                                "[]",
                                "[]")));
        when(repository.findByCircleIdAndFingerprintSetKey(circleId, fp.encoded()))
                .thenReturn(Optional.of(entity));

        assertThat(service.findByCircleAndFingerprints(circleId, List.of(fp)))
                .isPresent()
                .get()
                .satisfies(
                        dto -> {
                            assertThat(dto.circleId()).isEqualTo(circleId);
                            assertThat(dto.members().getFirst().fingerprint()).isEqualTo(fp);
                        });
    }
}
