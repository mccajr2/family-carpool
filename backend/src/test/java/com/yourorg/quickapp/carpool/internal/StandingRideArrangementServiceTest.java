package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.carpool.StandingRideArrangementDto;
import com.yourorg.quickapp.carpool.StandingRideArrangementStatus;
import com.yourorg.quickapp.carpool.StandingRideAskKidDto;
import com.yourorg.quickapp.carpool.StandingRideAskLegDto;
import com.yourorg.quickapp.carpool.StandingRideAskTemplateDto;
import com.yourorg.quickapp.carpool.StandingRideAssignment;
import com.yourorg.quickapp.feeds.RecurringFeedFingerprint;
import java.time.DayOfWeek;
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
class StandingRideArrangementServiceTest {

    @Mock
    private StandingRideArrangementRepository repository;

    @InjectMocks
    private StandingRideArrangementService service;

    private final UUID spaceId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID adultId = UUID.randomUUID();
    private final UUID kidId = UUID.randomUUID();
    private final UUID feedId = UUID.randomUUID();

    @Test
    void createPersistsOpenFixedPrimaryWithFingerprintAndAskTemplate() {
        when(repository.findBySpaceIdAndRequestingCircleIdAndFingerprintEncodedAndStatusIn(
                        any(), any(), any(), any()))
                .thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "Rink A");
        StandingRideAskTemplateDto ask = sampleAsk(CarpoolMeetSide.ACCEPTOR);

        StandingRideArrangementDto saved =
                service.create(spaceId, circleId, adultId, fp, "America/New_York", ask);

        ArgumentCaptor<StandingRideArrangementEntity> captor =
                ArgumentCaptor.forClass(StandingRideArrangementEntity.class);
        verify(repository).save(captor.capture());
        StandingRideArrangementEntity entity = captor.getValue();
        assertThat(entity.spaceId()).isEqualTo(spaceId);
        assertThat(entity.requestingCircleId()).isEqualTo(circleId);
        assertThat(entity.requestedByAdultId()).isEqualTo(adultId);
        assertThat(entity.feedId()).isEqualTo(feedId);
        assertThat(entity.dayOfWeek()).isEqualTo("TUESDAY");
        assertThat(entity.minuteOfDay()).isEqualTo(17 * 60);
        assertThat(entity.normalizedLocation()).isEqualTo("rink a");
        assertThat(entity.fingerprintEncoded()).isEqualTo(fp.encoded());
        assertThat(entity.assignment()).isEqualTo(StandingRideAssignment.FIXED_PRIMARY);
        assertThat(entity.status()).isEqualTo(StandingRideArrangementStatus.OPEN);
        assertThat(entity.primaryAdultId()).isNull();
        assertThat(entity.kids()).singleElement().satisfies(k -> {
            assertThat(k.kidId()).isEqualTo(kidId);
            assertThat(k.firstName()).isEqualTo("Sam");
        });
        assertThat(entity.legs()).hasSize(2);
        assertThat(entity.legs().getFirst().kind()).isEqualTo(CarpoolLegKind.TO);
        assertThat(entity.legs().getFirst().phase()).isEqualTo(CarpoolLegPhase.ASKED_TEAM);
        assertThat(entity.legs().getFirst().meetSide()).isEqualTo(CarpoolMeetSide.ACCEPTOR);
        assertThat(entity.legs().get(1).phase()).isEqualTo(CarpoolLegPhase.NEEDS_RIDE);

        assertThat(saved.status()).isEqualTo(StandingRideArrangementStatus.OPEN);
        assertThat(saved.assignment()).isEqualTo(StandingRideAssignment.FIXED_PRIMARY);
        assertThat(saved.fingerprint()).isEqualTo(fp);
        assertThat(saved.askTemplate().kids()).hasSize(1);
        assertThat(saved.askTemplate().legs()).hasSize(2);
    }

    @Test
    void createRejectsDuplicateNonEndedArrangement() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        StandingRideArrangementEntity existing =
                new StandingRideArrangementEntity(
                        UUID.randomUUID(),
                        spaceId,
                        circleId,
                        adultId,
                        feedId,
                        "TUESDAY",
                        17 * 60,
                        "rink a",
                        fp.encoded(),
                        "America/New_York",
                        List.of(new RideKidSnapshot(kidId, "Sam")),
                        List.of(
                                new StandingRideAskLegSlot(
                                        CarpoolLegKind.TO,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        CarpoolMeetSide.REQUESTER,
                                        null,
                                        null,
                                        "Home",
                                        "1 Main"),
                                new StandingRideAskLegSlot(
                                        CarpoolLegKind.FROM,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        CarpoolMeetSide.REQUESTER,
                                        null,
                                        null,
                                        "Home",
                                        "1 Main")),
                        java.time.Instant.now());
        when(repository.findBySpaceIdAndRequestingCircleIdAndFingerprintEncodedAndStatusIn(
                        eq(spaceId), eq(circleId), eq(fp.encoded()), any()))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(
                        () ->
                                service.create(
                                        spaceId,
                                        circleId,
                                        adultId,
                                        fp,
                                        "America/New_York",
                                        sampleAsk(CarpoolMeetSide.REQUESTER)))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex -> {
                            CarpoolException ce = (CarpoolException) ex;
                            assertThat(ce.status()).isEqualTo(HttpStatus.CONFLICT);
                        });
    }

    @Test
    void activateSetsPrimaryAndActiveStatus() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        UUID arrangementId = UUID.randomUUID();
        StandingRideArrangementEntity entity =
                new StandingRideArrangementEntity(
                        arrangementId,
                        spaceId,
                        circleId,
                        adultId,
                        feedId,
                        "TUESDAY",
                        17 * 60,
                        "rink a",
                        fp.encoded(),
                        "America/New_York",
                        List.of(new RideKidSnapshot(kidId, "Sam")),
                        List.of(
                                new StandingRideAskLegSlot(
                                        CarpoolLegKind.TO,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        CarpoolMeetSide.REQUESTER,
                                        null,
                                        null,
                                        null,
                                        null),
                                new StandingRideAskLegSlot(
                                        CarpoolLegKind.FROM,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        CarpoolMeetSide.REQUESTER,
                                        null,
                                        null,
                                        null,
                                        null)),
                        java.time.Instant.now());
        when(repository.findByIdAndSpaceId(arrangementId, spaceId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        UUID primaryAdult = UUID.randomUUID();
        UUID primaryCircle = UUID.randomUUID();
        StandingRideArrangementDto activated =
                service.activate(spaceId, arrangementId, primaryAdult, primaryCircle);

        assertThat(activated.status()).isEqualTo(StandingRideArrangementStatus.ACTIVE);
        assertThat(activated.primaryAdultId()).isEqualTo(primaryAdult);
        assertThat(activated.primaryCircleId()).isEqualTo(primaryCircle);
    }

    @Test
    void endMarksEndedAndClearsPrimary() {
        RecurringFeedFingerprint fp =
                new RecurringFeedFingerprint(feedId, DayOfWeek.TUESDAY, 17 * 60, "rink a");
        UUID arrangementId = UUID.randomUUID();
        StandingRideArrangementEntity entity =
                new StandingRideArrangementEntity(
                        arrangementId,
                        spaceId,
                        circleId,
                        adultId,
                        feedId,
                        "TUESDAY",
                        17 * 60,
                        "rink a",
                        fp.encoded(),
                        "America/New_York",
                        List.of(new RideKidSnapshot(kidId, "Sam")),
                        List.of(
                                new StandingRideAskLegSlot(
                                        CarpoolLegKind.TO,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        CarpoolMeetSide.REQUESTER,
                                        null,
                                        null,
                                        null,
                                        null),
                                new StandingRideAskLegSlot(
                                        CarpoolLegKind.FROM,
                                        CarpoolLegPhase.ASKED_TEAM,
                                        CarpoolMeetSide.REQUESTER,
                                        null,
                                        null,
                                        null,
                                        null)),
                        java.time.Instant.now());
        entity.activate(UUID.randomUUID(), UUID.randomUUID());
        when(repository.findByIdAndSpaceId(arrangementId, spaceId)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        StandingRideArrangementDto ended = service.end(spaceId, arrangementId);

        assertThat(ended.status()).isEqualTo(StandingRideArrangementStatus.ENDED);
        assertThat(ended.primaryAdultId()).isNull();
        assertThat(ended.primaryCircleId()).isNull();
        assertThat(ended.endedAt()).isNotNull();
    }

    private StandingRideAskTemplateDto sampleAsk(CarpoolMeetSide toMeet) {
        return new StandingRideAskTemplateDto(
                List.of(new StandingRideAskKidDto(kidId, "Sam")),
                List.of(
                        new StandingRideAskLegDto(
                                CarpoolLegKind.TO,
                                CarpoolLegPhase.ASKED_TEAM,
                                null,
                                null,
                                "Home",
                                "1 Main",
                                toMeet),
                        new StandingRideAskLegDto(
                                CarpoolLegKind.FROM,
                                CarpoolLegPhase.NEEDS_RIDE,
                                null,
                                null,
                                null,
                                null,
                                CarpoolMeetSide.REQUESTER)));
    }
}
