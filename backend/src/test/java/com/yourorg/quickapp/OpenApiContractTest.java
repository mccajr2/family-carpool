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
        assertThat(yaml).contains("/api/family/circle/calendar/leave-by");
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
        assertThat(yaml).contains("operationId: listCalendarLeaveBy");
        assertThat(yaml).contains("operationId: setCalendarLeaveFrom");
        assertThat(yaml).contains("operationId: setCoverageLeaveFrom");
        assertThat(yaml).contains("operationId: setDefaultLeaveFrom");
        assertThat(yaml).contains("operationId: assignCalendarCoverage");
        assertThat(yaml).contains("operationId: reassignCalendarCoverage");
        assertThat(yaml).contains("operationId: removeCalendarCoverage");
        assertThat(yaml).contains("same transaction");
        assertThat(yaml).contains("accepting circle");
        assertThat(yaml).contains("operationId: confirmCalendarCoverage");
        assertThat(yaml).contains("operationId: declineCalendarCoverage");
        assertThat(yaml).contains("operationId: setCalendarRsvp");
        assertThat(yaml).contains("/api/family/circle/calendar/{source}/{itemId}/leave-from");
        assertThat(yaml).contains("/api/family/circle/default-leave-from");
        assertThat(yaml).contains(
                "/api/family/circle/calendar/{source}/{itemId}/coverages");
        assertThat(yaml).contains(
                "/api/family/circle/calendar/{source}/{itemId}/rsvps/{kidId}");
        assertThat(yaml).contains("/api/family/circle/calendar/coverages/{assignmentId}");
        assertThat(yaml).contains(
                "/api/family/circle/calendar/coverages/{assignmentId}/leave-from");
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
        assertThat(yaml).contains("Null for MANUAL items");
        assertThat(yaml).contains("CalendarConflict:");
        assertThat(yaml).contains("CalendarConflictType:");
        assertThat(yaml).contains("KID_TIME_OVERLAP");
        assertThat(yaml).contains("ADULT_COVERAGE_OVERLAP");
        assertThat(yaml).contains("LeaveByStatus:");
        assertThat(yaml).contains("CalendarLeaveBy:");
        assertThat(yaml).contains("CalendarCoverageLeaveBy:");
        assertThat(yaml).contains("listCalendarLeaveBy never");
        assertThat(yaml).contains("This list does **not** call Nominatim");
        assertThat(yaml).contains("SetCalendarLeaveFromRequest:");
        assertThat(yaml).contains("leaveFromAddress:");
        assertThat(yaml).contains("one-time");
        assertThat(yaml).contains("SetDefaultLeaveFromRequest:");
        assertThat(yaml).contains("CoverageStatus:");
        assertThat(yaml).contains("RsvpStatus:");
        assertThat(yaml).contains("CalendarRsvp:");
        assertThat(yaml).contains("SetCalendarRsvpRequest:");
        assertThat(yaml).contains("CalendarCoverageAssignment:");
        assertThat(yaml).contains("AssignCalendarCoverageRequest:");
        assertThat(yaml).contains("coverages:");
        assertThat(yaml).contains("uncoveredKidIds:");
        assertThat(yaml).contains("conflicts:");
        assertThat(yaml).contains("rsvps:");
        assertThat(yaml).contains("NO_RESPONSE");
        assertThat(yaml).contains("set to RSVP YES");
        assertThat(yaml).contains("kid RSVP is NO");
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
        assertThat(yaml).contains("version: 0.30.0");
        assertThat(yaml).contains("background poller");
        assertThat(yaml).contains("manual events");
        assertThat(yaml).contains("unified circle calendar");
        assertThat(yaml).contains("estimated leave-by");
        assertThat(yaml).contains("confirmed-ride multi-stop route");
        assertThat(yaml).contains("resolved leave-from");
        assertThat(yaml).contains("operationId: getCalendarRoute");
        assertThat(yaml).contains("/api/family/circle/calendar/{source}/{itemId}/route");
        assertThat(yaml).contains("CalendarRoute:");
        assertThat(yaml).contains("CalendarRouteStatus:");
        assertThat(yaml).contains("legMinutes:");
        assertThat(yaml).contains("bufferMinutes:");
        assertThat(yaml).contains("operationId: getCalendarPlaylist");
        assertThat(yaml).contains("operationId: openCalendarPlaylist");
        assertThat(yaml).contains("/api/family/circle/calendar/{source}/{itemId}/playlist");
        assertThat(yaml).contains("/api/family/circle/calendar/{source}/{itemId}/playlist/open");
        assertThat(yaml).contains("CalendarPlaylist:");
        assertThat(yaml).contains("CalendarPlaylistRider:");
        assertThat(yaml).contains("CalendarPlaylistOpen:");
        assertThat(yaml).contains("OpenCalendarPlaylistRequest:");
        assertThat(yaml).contains("coverage responsibility");
        assertThat(yaml).contains("per-kid event RSVP");
        assertThat(yaml).contains("default leave-from");
        assertThat(yaml).contains("schedule conflicts");
        assertThat(yaml).contains("overlapping CONFIRMED");
        assertThat(yaml).contains("components:");
    }

    @Test
    void playlistContractDocumentsSpotifyOAuthDesignationsAndHandoff() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).contains("  - name: playlist");
        assertThat(yaml).contains("/api/playlist/spotify/authorize");
        assertThat(yaml).contains("/api/playlist/spotify/callback");
        assertThat(yaml).contains("/api/playlist/spotify/status");
        assertThat(yaml).contains("/api/playlist/spotify/revoke");
        assertThat(yaml).contains("/api/playlist/spotify/playlists");
        assertThat(yaml).contains("/api/playlist/designations");
        assertThat(yaml).contains("/api/playlist/designations/{kidId}");

        assertThat(yaml).contains("operationId: getSpotifyAuthorize");
        assertThat(yaml).contains("operationId: spotifyOAuthCallback");
        assertThat(yaml).contains("operationId: getSpotifyStatus");
        assertThat(yaml).contains("operationId: revokeSpotify");
        assertThat(yaml).contains("operationId: listSpotifyPlaylists");
        assertThat(yaml).contains("operationId: listKidPlaylistDesignations");
        assertThat(yaml).contains("operationId: setKidPlaylistDesignation");
        assertThat(yaml).contains("operationId: clearKidPlaylistDesignation");

        assertThat(yaml).contains("SpotifyAuthorize:");
        assertThat(yaml).contains("SpotifyConnectionStatus:");
        assertThat(yaml).contains("SpotifyPlaylistOption:");
        assertThat(yaml).contains("KidPlaylistDesignation:");
        assertThat(yaml).contains("SetKidPlaylistDesignationRequest:");
        assertThat(yaml).contains("encrypted refresh");
        assertThat(yaml).contains("Carpool merge");
        assertThat(yaml).contains("version: 0.30.0");
    }

    @Test
    void carpoolContractDocumentsSpaceInviteJoinAndRequests() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).contains("  - name: carpool");
        assertThat(yaml).contains("/api/carpool:");
        assertThat(yaml).contains("/api/carpool/enable");
        assertThat(yaml).contains("/api/carpool/join");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/invite/regenerate");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/leave");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/requests");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/requests/{requestId}/admit");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/requests/{requestId}/decline");

        assertThat(yaml).contains("operationId: getCarpoolSummary");
        assertThat(yaml).contains("operationId: enableCarpoolSpace");
        assertThat(yaml).contains("operationId: joinCarpoolSpace");
        assertThat(yaml).contains("operationId: getCarpoolSpace");
        assertThat(yaml).contains("operationId: regenerateCarpoolInvite");
        assertThat(yaml).contains("operationId: leaveCarpoolSpace");
        assertThat(yaml).contains("operationId: createCarpoolJoinRequest");
        assertThat(yaml).contains("operationId: admitCarpoolJoinRequest");
        assertThat(yaml).contains("operationId: declineCarpoolJoinRequest");

        assertThat(yaml).contains("CarpoolSummary:");
        assertThat(yaml).contains("CarpoolFeedStatus:");
        assertThat(yaml).contains("CarpoolFeedStatusKind:");
        assertThat(yaml).contains("CarpoolSpace:");
        assertThat(yaml).contains("CarpoolSpaceMember:");
        assertThat(yaml).contains("CarpoolSpaceMembership:");
        assertThat(yaml).contains("CarpoolJoinRequest:");
        assertThat(yaml).contains("CarpoolInvite:");
        assertThat(yaml).contains("EnableCarpoolSpaceRequest:");
        assertThat(yaml).contains("JoinCarpoolSpaceRequest:");
        assertThat(yaml).contains("circleRole:");
        assertThat(yaml).contains("inviteCode:");
        assertThat(yaml).contains("pendingRequests:");
        assertThat(yaml).contains("requestedByDisplayName:");
        assertThat(yaml).contains("callerFeedId:");
        assertThat(yaml).contains("[NONE, AVAILABLE, REQUESTED, MEMBER, OWNER]");
        assertThat(yaml).contains("[OWNER, MEMBER]");

        assertThat(yaml).contains("one per normalized feed URL");
        assertThat(yaml).contains("Organizer-only");
        assertThat(yaml).contains("Caller is a Caregiver (Organizer-only)");
        assertThat(yaml).contains("ensureFeed");
        assertThat(yaml).contains("in-app");
        assertThat(yaml).contains("no email/push");
        assertThat(yaml).contains("No TTL");
        assertThat(yaml).contains("Owner cannot leave while other member circles remain");
        assertThat(yaml).contains("A space already exists for this feed's normalized URL");
        assertThat(yaml).contains("Invite code unknown or no longer valid");
        assertThat(yaml).contains("Does not add a feed");
        assertThat(yaml).contains("version: 0.30.0");
    }

    @Test
    void carpoolContractDocumentsRideRequests() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/rides");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/ride-plans");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/ride-plans/confirm-household");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/ride-plans/decline-household");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/ride-plans/clear-legs");
        assertThat(yaml).contains("/api/carpool/ride-plans");
        assertThat(yaml).contains("/api/carpool/ride-plans/confirm-household");
        assertThat(yaml).contains("/api/carpool/ride-plans/decline-household");
        assertThat(yaml).contains("/api/carpool/ride-plans/clear-legs");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/rides/{rideId}/accept");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/rides/{rideId}/pass");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/rides/{rideId}/cancel");
        assertThat(yaml).contains("/api/carpool/spaces/{spaceId}/rides/{rideId}/withdraw");

        assertThat(yaml).contains("operationId: listCarpoolRides");
        assertThat(yaml).contains("operationId: createCarpoolRide");
        assertThat(yaml).contains("operationId: saveCarpoolRidePlan");
        assertThat(yaml).contains("operationId: confirmHouseholdRidePlan");
        assertThat(yaml).contains("operationId: declineHouseholdRidePlan");
        assertThat(yaml).contains("operationId: clearCarpoolRidePlanLegs");
        assertThat(yaml).contains("operationId: listCircleRidePlans");
        assertThat(yaml).contains("operationId: saveCircleRidePlan");
        assertThat(yaml).contains("operationId: confirmCircleHouseholdRidePlan");
        assertThat(yaml).contains("operationId: declineCircleHouseholdRidePlan");
        assertThat(yaml).contains("operationId: clearCircleRidePlanLegs");
        assertThat(yaml).contains("operationId: acceptCarpoolRide");
        assertThat(yaml).contains("operationId: passCarpoolRide");
        assertThat(yaml).contains("operationId: cancelCarpoolRide");
        assertThat(yaml).contains("operationId: withdrawCarpoolRide");

        assertThat(yaml).contains("CarpoolRide:");
        assertThat(yaml).contains("CarpoolRideStatus:");
        assertThat(yaml).contains("CarpoolRideEvent:");
        assertThat(yaml).contains("CreateCarpoolRideRequest:");
        assertThat(yaml).contains("SaveCarpoolRidePlanRequest:");
        assertThat(yaml).contains("ClearCarpoolRidePlanRequest:");
        assertThat(yaml).contains("requestedByAdultId:");
        assertThat(yaml).contains("requestedByDisplayName:");
        assertThat(yaml).contains("PENDING, ACCEPTED, or PLAN");
        assertThat(yaml).contains("HouseholdRidePlanActionRequest:");
        assertThat(yaml).contains("SaveCarpoolRidePlanResponse:");
        assertThat(yaml).contains("SaveCarpoolRidePlanLeg:");
        assertThat(yaml).contains("CarpoolRidePlanLegAction:");
        assertThat(yaml).contains("CarpoolLegKind:");
        assertThat(yaml).contains("CarpoolLegPhase:");
        assertThat(yaml).contains("CarpoolRideLeg:");
        assertThat(yaml).contains("ownLegs:");
        assertThat(yaml).contains("CancelCarpoolRideRequest:");
        assertThat(yaml).contains("WithdrawCarpoolRideRequest:");
        assertThat(yaml).contains("[NEEDS_RIDE, WAITING_HOUSEHOLD, ASKED_TEAM, CONFIRMED]");
        assertThat(yaml).contains("[TO, FROM]");
        assertThat(yaml).contains("[HOUSEHOLD, ASK_TEAM, NEEDS_RIDE]");
        assertThat(yaml).doesNotContain("AcceptCarpoolRideRequest:");
        assertThat(yaml).contains("[PENDING, ACCEPTED, CANCELLED]");
        assertThat(yaml).contains("eventKey:");
        assertThat(yaml).contains("defaultKidIds:");
        assertThat(yaml).contains("ownRequest:");
        assertThat(yaml).contains("otherRequests:");
        assertThat(yaml).contains("passedByMe:");
        assertThat(yaml).contains("passedByAdultNames:");
        assertThat(yaml).contains("kidFirstNames:");
        assertThat(yaml).contains("pickupPlaceName:");
        assertThat(yaml).contains("pickupAddress:");
        assertThat(yaml).contains("pickupTown:");
        assertThat(yaml).contains("detourMinutes:");
        assertThat(yaml).contains("acceptingCircleId:");
        assertThat(yaml).doesNotContain("vehicleId:");
        assertThat(yaml).doesNotContain("vehicleLabel:");
        assertThat(yaml).contains("not exceed 31 days");
        assertThat(yaml).doesNotContain("drives=false returns 403");
        assertThat(yaml).contains("body (like Pass)");
        assertThat(yaml).contains("No drives check, vehicle selection, or seat-capacity");
        assertThat(yaml).contains("GET /api/carpool/spaces/{spaceId}/rides");
        assertThat(yaml).contains("passedByMe true");
        assertThat(yaml).contains("soft decline");
        assertThat(yaml).contains("Accept remains allowed while PENDING");
        assertThat(yaml).contains("idempotent");
        assertThat(yaml).contains("YES and NO_RESPONSE both qualify");
        assertThat(yaml).contains("Create does not change RSVP");
        assertThat(yaml).contains("sets RSVP YES for the");
        assertThat(yaml).contains("requesting circle's kids on that ride");
        assertThat(yaml).contains("Allowed even when the caller");
        assertThat(yaml).contains("previously passed");
        assertThat(yaml).contains("Save ride plan");
        assertThat(yaml).contains("no per-leg place");
        assertThat(yaml).contains("withdraw first");
        assertThat(yaml).contains("version: 0.30.0");
    }

    /**
     * Fence until garage-capacity (or successor) revive: garage HTTP paths and
     * schemas must stay absent from OpenAPI. A dedicated revive slice owns
     * re-adding them and replacing these asserts.
     */
    @Test
    void garageContractPathsAndSchemasAreAbsentUntilRevive() throws IOException {
        String yaml = Files.readString(resolveOpenApi());

        assertThat(yaml).doesNotContain("/api/family/circle/garage");
        assertThat(yaml).doesNotContain("operationId: getFamilyGarage");
        assertThat(yaml).doesNotContain("operationId: patchGarageDrives");
        assertThat(yaml).doesNotContain("operationId: listGarageMakes");
        assertThat(yaml).doesNotContain("operationId: listGarageModels");
        assertThat(yaml).doesNotContain("operationId: suggestGarageSeats");
        assertThat(yaml).doesNotContain("operationId: addVehicle");
        assertThat(yaml).doesNotContain("operationId: updateVehicle");
        assertThat(yaml).doesNotContain("operationId: deleteVehicle");
        assertThat(yaml).doesNotContain("operationId: suggestVehicleSeats");

        assertThat(yaml).doesNotContain("\n    Garage:");
        assertThat(yaml).doesNotContain("GarageMemberDrives:");
        assertThat(yaml).doesNotContain("\n    Vehicle:");
        assertThat(yaml).doesNotContain("CreateVehicleRequest:");
        assertThat(yaml).doesNotContain("UpdateVehicleRequest:");
        assertThat(yaml).doesNotContain("PatchGarageDrivesRequest:");
        assertThat(yaml).doesNotContain("SuggestSeatsRequest:");
        assertThat(yaml).doesNotContain("SuggestSeatsResponse:");
        assertThat(yaml).doesNotContain("VehicleMake:");
        assertThat(yaml).doesNotContain("VehicleModel:");
        assertThat(yaml).doesNotContain("driverAdultIds:");
        assertThat(yaml).doesNotContain("suggestedSeats:");
        assertThat(yaml).doesNotContain("AcceptCarpoolRideRequest:");
        assertThat(yaml).doesNotContain("vPIC");
        assertThat(yaml).doesNotContain("vpic");
    }

    private static Path resolveOpenApi() {
        Path fromBackend = Path.of("..", "contracts", "openapi.yaml").normalize().toAbsolutePath();
        if (Files.exists(fromBackend)) {
            return fromBackend;
        }
        return Path.of("contracts", "openapi.yaml").toAbsolutePath();
    }
}
