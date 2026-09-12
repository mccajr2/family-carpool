package com.yourorg.quickapp.carpool;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.internal.CarpoolRideService;
import com.yourorg.quickapp.carpool.internal.CarpoolService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/carpool")
public class CarpoolController {

    private final AdultSessionApi adultSessionApi;
    private final CarpoolService carpoolService;
    private final CarpoolRideService carpoolRideService;

    public CarpoolController(
            AdultSessionApi adultSessionApi,
            CarpoolService carpoolService,
            CarpoolRideService carpoolRideService) {
        this.adultSessionApi = adultSessionApi;
        this.carpoolService = carpoolService;
        this.carpoolRideService = carpoolRideService;
    }

    @GetMapping
    public CarpoolSummaryResponse summary(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.summary(adult);
    }

    @PostMapping("/enable")
    @ResponseStatus(HttpStatus.CREATED)
    public CarpoolSpaceResponse enable(
            @Valid @RequestBody EnableCarpoolSpaceRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.enable(adult, request);
    }

    @PostMapping("/join")
    public CarpoolSpaceResponse join(
            @Valid @RequestBody JoinCarpoolSpaceRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.join(adult, request);
    }

    @GetMapping("/ride-plans")
    public List<CarpoolRideEventResponse> listCircleRidePlans(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.listCirclePlans(adult);
    }

    @PostMapping("/ride-plans")
    public SaveCarpoolRidePlanResponse saveCircleRidePlan(
            @Valid @RequestBody SaveCarpoolRidePlanRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.saveCirclePlan(adult, request);
    }

    @PostMapping("/ride-plans/confirm-household")
    public SaveCarpoolRidePlanResponse confirmCircleHouseholdRidePlan(
            @Valid @RequestBody HouseholdRidePlanActionRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.confirmCircleHouseholdPlan(adult, request.eventKey());
    }

    @PostMapping("/ride-plans/decline-household")
    public SaveCarpoolRidePlanResponse declineCircleHouseholdRidePlan(
            @Valid @RequestBody HouseholdRidePlanActionRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.declineCircleHouseholdPlan(adult, request.eventKey());
    }

    @PostMapping("/ride-plans/clear-legs")
    public SaveCarpoolRidePlanResponse clearCircleRidePlanLegs(
            @Valid @RequestBody ClearCarpoolRidePlanRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.clearCirclePlanLegs(adult, request.eventKey(), request.legs());
    }

    @GetMapping("/spaces/{spaceId}")
    public CarpoolSpaceResponse getSpace(
            @PathVariable("spaceId") UUID spaceId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.getSpace(adult, spaceId);
    }

    @PostMapping("/spaces/{spaceId}/invite/regenerate")
    public CarpoolInviteResponse regenerateInvite(
            @PathVariable("spaceId") UUID spaceId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.regenerateInvite(adult, spaceId);
    }

    @PostMapping("/spaces/{spaceId}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable("spaceId") UUID spaceId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        carpoolService.leave(adult, spaceId);
    }

    @PostMapping("/spaces/{spaceId}/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public CarpoolJoinRequestResponse createRequest(
            @PathVariable("spaceId") UUID spaceId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.createRequest(adult, spaceId);
    }

    @PostMapping("/spaces/{spaceId}/requests/{requestId}/admit")
    public CarpoolSpaceResponse admit(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("requestId") UUID requestId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolService.admit(adult, spaceId, requestId);
    }

    @PostMapping("/spaces/{spaceId}/requests/{requestId}/decline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("requestId") UUID requestId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        carpoolService.decline(adult, spaceId, requestId);
    }

    @GetMapping("/spaces/{spaceId}/rides")
    public List<CarpoolRideEventResponse> listRides(
            @PathVariable("spaceId") UUID spaceId,
            @RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.list(adult, spaceId, from, to);
    }

    @PostMapping("/spaces/{spaceId}/rides")
    @ResponseStatus(HttpStatus.CREATED)
    public CarpoolRideResponse createRide(
            @PathVariable("spaceId") UUID spaceId,
            @Valid @RequestBody CreateCarpoolRideRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.create(adult, spaceId, request);
    }

    @PostMapping("/spaces/{spaceId}/ride-plans")
    public SaveCarpoolRidePlanResponse saveRidePlan(
            @PathVariable("spaceId") UUID spaceId,
            @Valid @RequestBody SaveCarpoolRidePlanRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.savePlan(adult, spaceId, request);
    }

    @PostMapping("/spaces/{spaceId}/ride-plans/confirm-household")
    public SaveCarpoolRidePlanResponse confirmHouseholdRidePlan(
            @PathVariable("spaceId") UUID spaceId,
            @Valid @RequestBody HouseholdRidePlanActionRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.confirmHouseholdPlan(adult, spaceId, request.eventKey());
    }

    @PostMapping("/spaces/{spaceId}/ride-plans/decline-household")
    public SaveCarpoolRidePlanResponse declineHouseholdRidePlan(
            @PathVariable("spaceId") UUID spaceId,
            @Valid @RequestBody HouseholdRidePlanActionRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.declineHouseholdPlan(adult, spaceId, request.eventKey());
    }

    @PostMapping("/spaces/{spaceId}/ride-plans/clear-legs")
    public SaveCarpoolRidePlanResponse clearHouseholdRidePlanLegs(
            @PathVariable("spaceId") UUID spaceId,
            @Valid @RequestBody ClearCarpoolRidePlanRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.clearPlanLegs(
                adult, spaceId, request.eventKey(), request.legs());
    }

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/accept")
    public CarpoolRideResponse acceptRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.accept(adult, spaceId, rideId);
    }

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/pass")
    public CarpoolRideResponse passRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.pass(adult, spaceId, rideId);
    }

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/cancel")
    public CarpoolRideResponse cancelRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            @RequestBody(required = false) CancelCarpoolRideRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.cancel(
                adult, spaceId, rideId, request == null ? null : request.legs());
    }

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/withdraw")
    public CarpoolRideResponse withdrawRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            @RequestBody(required = false) WithdrawCarpoolRideRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.withdraw(
                adult, spaceId, rideId, request == null ? null : request.legs());
    }
}
