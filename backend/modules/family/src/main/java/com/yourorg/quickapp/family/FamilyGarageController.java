package com.yourorg.quickapp.family;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.internal.GarageService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/family/circle/garage")
public class FamilyGarageController {

    private final AdultSessionApi adultSessionApi;
    private final GarageService garageService;

    public FamilyGarageController(AdultSessionApi adultSessionApi, GarageService garageService) {
        this.adultSessionApi = adultSessionApi;
        this.garageService = garageService;
    }

    @GetMapping
    public GarageResponse get(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.get(adult);
    }

    @PatchMapping("/me")
    public GarageResponse patchDrives(
            @RequestBody PatchGarageDrivesRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.patchDrives(adult, request);
    }

    @GetMapping("/makes")
    public List<VehicleMakeResponse> makes(HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.listMakes(adult);
    }

    @GetMapping("/models")
    public List<VehicleModelResponse> models(
            @RequestParam("year") Integer year,
            @RequestParam("make") String make,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.listModels(adult, year, make);
    }

    @PostMapping("/suggest-seats")
    public SuggestSeatsResponse suggestSeats(
            @RequestBody SuggestSeatsRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.suggestSeats(adult, request);
    }

    @PostMapping("/vehicles")
    @ResponseStatus(HttpStatus.CREATED)
    public VehicleResponse create(
            @RequestBody CreateVehicleRequest request, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.create(adult, request);
    }

    @PutMapping("/vehicles/{vehicleId}")
    public VehicleResponse update(
            @PathVariable("vehicleId") UUID vehicleId,
            @RequestBody UpdateVehicleRequest request,
            HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.update(adult, vehicleId, request);
    }

    @DeleteMapping("/vehicles/{vehicleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable("vehicleId") UUID vehicleId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        garageService.delete(adult, vehicleId);
    }

    @PostMapping("/vehicles/{vehicleId}/suggest-seats")
    public SuggestSeatsResponse suggestSeatsForVehicle(
            @PathVariable("vehicleId") UUID vehicleId, HttpServletRequest httpRequest) {
        AdultResponse adult = adultSessionApi.requireCurrentAdult(httpRequest);
        return garageService.suggestSeatsForVehicle(adult, vehicleId);
    }
}
