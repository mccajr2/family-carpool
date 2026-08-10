package com.yourorg.quickapp.family;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.internal.FamilyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/family")
public class FamilyController {

    private final AdultSessionApi adultSessionApi;
    private final FamilyService familyService;

    public FamilyController(AdultSessionApi adultSessionApi, FamilyService familyService) {
        this.adultSessionApi = adultSessionApi;
        this.familyService = familyService;
    }

    @PostMapping("/circle")
    @ResponseStatus(HttpStatus.CREATED)
    public FamilyCircleResponse create(
            @Valid @RequestBody CreateFamilyCircleRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.create(adult, request);
    }

    @GetMapping("/circle")
    public FamilyCircleResponse get(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.get(adult);
    }

    @PatchMapping("/circle")
    public FamilyCircleResponse update(
            @Valid @RequestBody UpdateFamilyCircleRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.update(adult, request);
    }

    @GetMapping("/circle/invite")
    public FamilyInviteResponse getInvite(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.getInvite(adult);
    }

    @PostMapping("/circle/invite/regenerate")
    public FamilyInviteResponse regenerateInvite(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.regenerateInvite(adult);
    }

    @PostMapping("/circle/join")
    public FamilyCircleResponse join(
            @Valid @RequestBody JoinFamilyCircleRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.join(adult, request);
    }

    @PostMapping("/circle/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        familyService.leave(adult);
    }

    @PatchMapping("/circle/members/{adultId}")
    public FamilyCircleResponse updateMemberRole(
            @PathVariable("adultId") UUID adultId,
            @Valid @RequestBody UpdateFamilyMemberRoleRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.updateMemberRole(adult, adultId, request);
    }

    @DeleteMapping("/circle/members/{adultId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @PathVariable("adultId") UUID adultId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        familyService.removeMember(adult, adultId);
    }

    @PostMapping("/circle/kids")
    @ResponseStatus(HttpStatus.CREATED)
    public KidResponse addKid(
            @Valid @RequestBody CreateKidRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.addKid(adult, request);
    }

    @PatchMapping("/circle/kids/{kidId}")
    public KidResponse updateKid(
            @PathVariable("kidId") UUID kidId,
            @Valid @RequestBody UpdateKidRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return familyService.updateKid(adult, kidId, request);
    }

    @DeleteMapping("/circle/kids/{kidId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteKid(@PathVariable("kidId") UUID kidId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        familyService.deleteKid(adult, kidId);
    }
}
