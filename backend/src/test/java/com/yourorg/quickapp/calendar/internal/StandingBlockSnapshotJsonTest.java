package com.yourorg.quickapp.calendar.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.quickapp.calendar.StandingCoverageSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanLegSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRidePlanSnapshotDto;
import com.yourorg.quickapp.calendar.StandingRouteOriginSnapshotDto;
import com.yourorg.quickapp.carpool.CarpoolLegKind;
import com.yourorg.quickapp.carpool.CarpoolLegPhase;
import com.yourorg.quickapp.carpool.CarpoolMeetSide;
import com.yourorg.quickapp.coverage.CoverageStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StandingBlockSnapshotJsonTest {

    @Test
    void coverageRidePlanAndRouteOriginRoundTrip() {
        UUID adultId = UUID.randomUUID();
        UUID kidId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();

        List<StandingCoverageSnapshotDto> coverages =
                List.of(
                        new StandingCoverageSnapshotDto(
                                adultId,
                                adultId,
                                CoverageStatus.PENDING,
                                List.of(kidId),
                                placeId,
                                null));
        List<StandingRidePlanSnapshotDto> plans =
                List.of(
                        new StandingRidePlanSnapshotDto(
                                List.of(kidId),
                                List.of(
                                        new StandingRidePlanLegSnapshotDto(
                                                CarpoolLegKind.TO,
                                                CarpoolLegPhase.CONFIRMED,
                                                adultId,
                                                circleId,
                                                placeId,
                                                "Home",
                                                "1 Main",
                                                CarpoolMeetSide.REQUESTER),
                                        new StandingRidePlanLegSnapshotDto(
                                                CarpoolLegKind.FROM,
                                                CarpoolLegPhase.NEEDS_RIDE,
                                                null,
                                                null,
                                                null,
                                                null,
                                                null,
                                                null))));
        List<StandingRouteOriginSnapshotDto> origins =
                List.of(
                        new StandingRouteOriginSnapshotDto(
                                adultId, CarpoolLegKind.FROM, null, null, "2 Oak"));

        assertThat(StandingBlockSnapshotJson.readCoverages(
                        StandingBlockSnapshotJson.writeCoverages(coverages)))
                .isEqualTo(coverages);
        assertThat(StandingBlockSnapshotJson.readRidePlans(
                        StandingBlockSnapshotJson.writeRidePlans(plans)))
                .isEqualTo(plans);
        assertThat(StandingBlockSnapshotJson.readRouteOrigins(
                        StandingBlockSnapshotJson.writeRouteOrigins(origins)))
                .isEqualTo(origins);
        assertThat(StandingBlockSnapshotJson.readCoverages("[]")).isEmpty();
    }
}
