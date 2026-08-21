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

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/accept")
    public CarpoolRideResponse acceptRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            @Valid @RequestBody AcceptCarpoolRideRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.accept(adult, spaceId, rideId, request);
    }

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/cancel")
    public CarpoolRideResponse cancelRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.cancel(adult, spaceId, rideId);
    }

    @PostMapping("/spaces/{spaceId}/rides/{rideId}/withdraw")
    public CarpoolRideResponse withdrawRide(
            @PathVariable("spaceId") UUID spaceId,
            @PathVariable("rideId") UUID rideId,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return carpoolRideService.withdraw(adult, spaceId, rideId);
    }
}
