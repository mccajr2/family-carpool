package com.yourorg.quickapp;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * Guards OpenAPI contract paths for auth + family circle. Fails if greeting
 * returns or required paths / Bearer scheme are removed.
 */
class OpenApiContractTest {

    @Test
    void authContractReplacesGreetingAndDocumentsBearerSessions() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).doesNotContain("/api/greeting");
        assertThat(yaml).doesNotContain("GreetingResponse");

        assertThat(yaml).contains("/api/auth/request-code");
        assertThat(yaml).contains("/api/auth/verify-code");
        assertThat(yaml).contains("/api/auth/me");
        assertThat(yaml).contains("/api/auth/logout");

        assertThat(yaml).contains("operationId: requestAuthCode");
        assertThat(yaml).contains("operationId: verifyAuthCode");
        assertThat(yaml).contains("operationId: getCurrentAdult");
        assertThat(yaml).contains("operationId: logout");

        assertThat(yaml).contains("bearerAuth:");
        assertThat(yaml).contains("scheme: bearer");
        assertThat(yaml).contains("AuthSessionResponse:");
        assertThat(yaml).contains("Adult:");
        assertThat(yaml).contains("devCode:");
    }

    @Test
    void familyContractDocumentsCircleAndKidsUnderBearer() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).contains("/api/family/circle");
        assertThat(yaml).contains("/api/family/circle/kids");
        assertThat(yaml).contains("/api/family/circle/kids/{kidId}");
        assertThat(yaml).contains("/api/family/circle/places");
        assertThat(yaml).contains("/api/family/circle/places/{placeId}");
        assertThat(yaml).contains("/api/family/circle/places/{placeId}/locate");
        assertThat(yaml).contains("/api/family/circle/feeds");
        assertThat(yaml).contains("/api/family/circle/feeds/{feedId}");
        assertThat(yaml).contains("/api/family/circle/feeds/{feedId}/sync");
        assertThat(yaml).contains("/api/family/circle/events");
        assertThat(yaml).contains("/api/family/circle/events/{eventId}");
        assertThat(yaml).contains("/api/family/circle/calendar");
        assertThat(yaml).contains("/api/family/circle/invite");
        assertThat(yaml).contains("/api/family/circle/invite/regenerate");
        assertThat(yaml).contains("/api/family/circle/join");
        assertThat(yaml).contains("/api/family/circle/leave");
        assertThat(yaml).contains("/api/family/circle/members/{adultId}");

        assertThat(yaml).contains("operationId: createFamilyCircle");
        assertThat(yaml).contains("operationId: getFamilyCircle");
        assertThat(yaml).contains("operationId: updateFamilyCircle");
        assertThat(yaml).contains("operationId: getFamilyInvite");
        assertThat(yaml).contains("operationId: regenerateFamilyInvite");
        assertThat(yaml).contains("operationId: joinFamilyCircle");
        assertThat(yaml).contains("operationId: leaveFamilyCircle");
        assertThat(yaml).contains("operationId: updateFamilyMemberRole");
        assertThat(yaml).contains("operationId: removeFamilyMember");
        assertThat(yaml).contains("operationId: addKid");
        assertThat(yaml).contains("operationId: updateKid");
        assertThat(yaml).contains("operationId: deleteKid");
        assertThat(yaml).contains("operationId: addPlace");
        assertThat(yaml).contains("operationId: updatePlace");
        assertThat(yaml).contains("operationId: deletePlace");
        assertThat(yaml).contains("operationId: locatePlace");
        assertThat(yaml).contains("operationId: listActivityFeeds");
        assertThat(yaml).contains("operationId: createActivityFeed");
        assertThat(yaml).contains("operationId: updateActivityFeed");
        assertThat(yaml).contains("operationId: deleteActivityFeed");
        assertThat(yaml).contains("operationId: syncActivityFeed");
        assertThat(yaml).contains("operationId: listManualEvents");
        assertThat(yaml).contains("operationId: createManualEvent");
        assertThat(yaml).contains("operationId: getManualEvent");
        assertThat(yaml).contains("operationId: updateManualEvent");
        assertThat(yaml).contains("operationId: deleteManualEvent");
        assertThat(yaml).contains("operationId: listCircleCalendar");
        assertThat(yaml).contains("operationId: setCalendarLeaveFrom");
        assertThat(yaml).contains("operationId: setDefaultLeaveFrom");
        assertThat(yaml).contains("operationId: assignCalendarCoverage");
        assertThat(yaml).contains("operationId: reassignCalendarCoverage");
        assertThat(yaml).contains("operationId: removeCalendarCoverage");
        assertThat(yaml).contains("operationId: confirmCalendarCoverage");
        assertThat(yaml).contains("operationId: declineCalendarCoverage");
        assertThat(yaml).contains("/api/family/circle/calendar/{source}/{itemId}/leave-from");
        assertThat(yaml).contains("/api/family/circle/default-leave-from");
        assertThat(yaml).contains(
                "/api/family/circle/calendar/{source}/{itemId}/coverages");
        assertThat(yaml).contains("/api/family/circle/calendar/coverages/{assignmentId}");
        assertThat(yaml).contains(
                "/api/family/circle/calendar/coverages/{assignmentId}/confirm");
        assertThat(yaml).contains(
                "/api/family/circle/calendar/coverages/{assignmentId}/decline");

        assertThat(yaml).contains("CreateFamilyCircleRequest:");
        assertThat(yaml).contains("UpdateFamilyCircleRequest:");
        assertThat(yaml).contains("JoinFamilyCircleRequest:");
        assertThat(yaml).contains("UpdateFamilyMemberRoleRequest:");
        assertThat(yaml).contains("FamilyCircle:");
        assertThat(yaml).contains("FamilyMember:");
        assertThat(yaml).contains("FamilyInvite:");
        assertThat(yaml).contains("FamilyRole:");
        assertThat(yaml).contains("Kid:");
        assertThat(yaml).contains("CreateKidRequest:");
        assertThat(yaml).contains("UpdateKidRequest:");
        assertThat(yaml).contains("Place:");
        assertThat(yaml).contains("CreatePlaceRequest:");
        assertThat(yaml).contains("UpdatePlaceRequest:");
        assertThat(yaml).contains("ActivityFeed:");
        assertThat(yaml).contains("CreateActivityFeedRequest:");
        assertThat(yaml).contains("UpdateActivityFeedRequest:");
        assertThat(yaml).contains("ManualEvent:");
        assertThat(yaml).contains("CreateManualEventRequest:");
        assertThat(yaml).contains("UpdateManualEventRequest:");
        assertThat(yaml).contains("CalendarItem:");
        assertThat(yaml).contains("CalendarItemSource:");
        assertThat(yaml).contains("CalendarConflict:");
        assertThat(yaml).contains("CalendarConflictType:");
        assertThat(yaml).contains("KID_TIME_OVERLAP");
        assertThat(yaml).contains("ADULT_COVERAGE_OVERLAP");
        assertThat(yaml).contains("LeaveByStatus:");
        assertThat(yaml).contains("SetCalendarLeaveFromRequest:");
        assertThat(yaml).contains("SetDefaultLeaveFromRequest:");
        assertThat(yaml).contains("CoverageStatus:");
        assertThat(yaml).contains("CalendarCoverageAssignment:");
        assertThat(yaml).contains("AssignCalendarCoverageRequest:");
        assertThat(yaml).contains("coverages:");
        assertThat(yaml).contains("uncoveredKidIds:");
        assertThat(yaml).contains("conflicts:");
        assertThat(yaml).contains("otherItemId:");
        assertThat(yaml).contains("otherStartsAt:");
        assertThat(yaml).contains("defaultLeaveFromPlaceId:");
        assertThat(yaml).contains("defaultLeaveFromPlaceName:");
        assertThat(yaml).contains("leaveFromPlaceId:");
        assertThat(yaml).contains("leaveFromPlaceName:");
        assertThat(yaml).contains("leaveByAt:");
        assertThat(yaml).contains("leaveByStatus:");
        assertThat(yaml).contains("leaveByReason:");
        assertThat(yaml).contains("sourceUrl:");
        assertThat(yaml).contains("lastSyncedAt:");
        assertThat(yaml).contains("lastSyncError:");
        assertThat(yaml).contains("eventCount:");
        assertThat(yaml).contains("latitude:");
        assertThat(yaml).contains("longitude:");
        assertThat(yaml).contains("adultDisplayName:");
        assertThat(yaml).contains("members:");
        assertThat(yaml).contains("places:");
        assertThat(yaml).contains("ORGANIZER");
        assertThat(yaml).contains("CAREGIVER");
        assertThat(yaml).contains("\"403\"");
        assertThat(yaml).contains("\"409\"");
        assertThat(yaml).contains("version: 0.12.0");
        assertThat(yaml).contains("background poller");
        assertThat(yaml).contains("manual events");
        assertThat(yaml).contains("unified circle calendar");
        assertThat(yaml).contains("estimated leave-by");
        assertThat(yaml).contains("coverage responsibility");
        assertThat(yaml).contains("default leave-from");
        assertThat(yaml).contains("schedule conflicts");
        assertThat(yaml).contains("overlapping CONFIRMED");
        assertThat(yaml).contains("components:");
    }

    private static Path resolveOpenApi() {
        Path fromBackend = Path.of("..", "contracts", "openapi.yaml").normalize().toAbsolutePath();
        if (Files.exists(fromBackend)) {
            return fromBackend;
        }
        return Path.of("contracts", "openapi.yaml").toAbsolutePath();
    }
}
