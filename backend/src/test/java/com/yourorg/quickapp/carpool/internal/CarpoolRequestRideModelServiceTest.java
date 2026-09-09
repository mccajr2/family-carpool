package com.yourorg.quickapp.carpool.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.carpool.CarpoolLeg;
import com.yourorg.quickapp.carpool.CarpoolNeededLeg;
import com.yourorg.quickapp.carpool.CarpoolRequestStatus;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CarpoolRequestRideModelServiceTest {

    private final CarpoolRequestRideModelService service = new CarpoolRequestRideModelService();

    @Test
    void normalizedLegsExpandsBothAndDefaultsRoundTrip() {
        assertThat(service.normalizedLegs(CarpoolLeg.BOTH, null))
                .containsExactlyInAnyOrder(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
        assertThat(service.normalizedLegs(null, null))
                .containsExactlyInAnyOrder(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);
        assertThat(service.normalizedLegs(CarpoolLeg.TO, null)).containsExactly(CarpoolNeededLeg.TO);
        assertThat(service.normalizedLegs(CarpoolLeg.FROM, null)).containsExactly(CarpoolNeededLeg.FROM);
    }

    @Test
    void deriveRequestStatusReturnsUncoveredPartialAndFullyCovered() {
        var needed = EnumSet.of(CarpoolNeededLeg.TO, CarpoolNeededLeg.FROM);

        var uncovered = service.deriveRequestStatus(needed, Set.of());
        assertThat(uncovered.rollup()).isEqualTo(CarpoolRequestStatus.UNCOVERED);
        assertThat(uncovered.legStatuses()).hasSize(2);

        var partial = service.deriveRequestStatus(needed, Set.of(CarpoolNeededLeg.TO));
        assertThat(partial.rollup()).isEqualTo(CarpoolRequestStatus.PARTIAL);
        assertThat(partial.legStatuses().stream().filter(s -> s.status().name().equals("CONFIRMED")).count())
                .isEqualTo(1);

        var covered = service.deriveRequestStatus(needed, needed);
        assertThat(covered.rollup()).isEqualTo(CarpoolRequestStatus.FULLY_COVERED);
    }

    @Test
    void requireUniqueRequestThrows409OnDuplicate() {
        CarpoolRequestRepository requests = mock(CarpoolRequestRepository.class);
        UUID spaceId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        when(requests.existsBySpaceIdAndEventKeyAndKidIdAndRequestingCircleId(
                        spaceId, "UID:event", kidId, circleId))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.requireUniqueRequest(
                                        spaceId, "UID:event", kidId, circleId, requests))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex ->
                                assertThat(((CarpoolException) ex).status())
                                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void requireNoPassengerLegConflictThrows409OnAlreadyAssignedLeg() {
        CarpoolRideRepository rides = mock(CarpoolRideRepository.class);
        UUID spaceId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        when(rides.existsActivePassengerAssignment(
                        spaceId,
                        "UID:event",
                        CarpoolNeededLeg.TO,
                        com.yourorg.quickapp.carpool.CarpoolFulfillmentStatus.ACTIVE,
                        requestId))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                service.requireNoPassengerLegConflict(
                                        spaceId,
                                        "UID:event",
                                        requestId,
                                        Set.of(CarpoolNeededLeg.TO),
                                        rides))
                .isInstanceOf(CarpoolException.class)
                .satisfies(
                        ex ->
                                assertThat(((CarpoolException) ex).status())
                                        .isEqualTo(HttpStatus.CONFLICT));
    }
}
