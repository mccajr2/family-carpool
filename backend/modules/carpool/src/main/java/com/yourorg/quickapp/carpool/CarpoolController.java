package com.yourorg.quickapp.carpool;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.carpool.internal.CarpoolService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/carpool")
public class CarpoolController {

    private final AdultSessionApi adultSessionApi;
    private final CarpoolService carpoolService;

    public CarpoolController(AdultSessionApi adultSessionApi, CarpoolService carpoolService) {
        this.adultSessionApi = adultSessionApi;
        this.carpoolService = carpoolService;
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
}
