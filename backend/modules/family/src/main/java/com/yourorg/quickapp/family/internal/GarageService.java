package com.yourorg.quickapp.family.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.CreateVehicleRequest;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.GarageMemberDrivesResponse;
import com.yourorg.quickapp.family.GarageResponse;
import com.yourorg.quickapp.family.PatchGarageDrivesRequest;
import com.yourorg.quickapp.family.SuggestSeatsRequest;
import com.yourorg.quickapp.family.SuggestSeatsResponse;
import com.yourorg.quickapp.family.UpdateVehicleRequest;
import com.yourorg.quickapp.family.VehicleMakeResponse;
import com.yourorg.quickapp.family.VehicleModelResponse;
import com.yourorg.quickapp.family.VehicleResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GarageService {

    static final int MIN_YEAR = 1996;
    static final int MIN_SEATS = 2;
    static final int MAX_SEATS = 18;

    private final AdultSessionApi adultSessionApi;
    private final FamilyMembershipRepository memberships;
    private final FamilyCircleRepository circles;
    private final FamilyPlaceRepository places;
    private final FamilyVehicleRepository vehicles;
    private final VpicLookupService vpicLookupService;
    private final Clock clock;

    @Autowired
    public GarageService(
            AdultSessionApi adultSessionApi,
            FamilyMembershipRepository memberships,
            FamilyCircleRepository circles,
            FamilyPlaceRepository places,
            FamilyVehicleRepository vehicles,
            VpicLookupService vpicLookupService) {
        this(
                adultSessionApi,
                memberships,
                circles,
                places,
                vehicles,
                vpicLookupService,
                Clock.systemUTC());
    }

    GarageService(
            AdultSessionApi adultSessionApi,
            FamilyMembershipRepository memberships,
            FamilyCircleRepository circles,
            FamilyPlaceRepository places,
            FamilyVehicleRepository vehicles,
            VpicLookupService vpicLookupService,
            Clock clock) {
        this.adultSessionApi = adultSessionApi;
        this.memberships = memberships;
        this.circles = circles;
        this.places = places;
        this.vehicles = vehicles;
        this.vpicLookupService = vpicLookupService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GarageResponse get(AdultResponse adult) {
        FamilyMembershipEntity membership = requireMembership(adult.id());
        return snapshot(membership.circleId());
    }

    @Transactional(readOnly = true)
    public GarageResponse snapshotForCircle(UUID circleId) {
        if (!circles.existsById(circleId)) {
            throw new FamilyAccessException(HttpStatus.NOT_FOUND, "Family circle not found");
        }
        return snapshot(circleId);
    }

    @Transactional
    public GarageResponse patchDrives(AdultResponse adult, PatchGarageDrivesRequest request) {
        FamilyMembershipEntity membership = requireMembership(adult.id());
        if (request == null || request.drives() == null) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "drives must not be null");
        }
        membership.setDrives(request.drives());
        memberships.save(membership);
        return snapshot(membership.circleId());
    }

    @Transactional(readOnly = true)
    public List<VehicleMakeResponse> listMakes(AdultResponse adult) {
        requireMembership(adult.id());
        return vpicLookupService.listMakes().stream().map(VehicleMakeResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public List<VehicleModelResponse> listModels(AdultResponse adult, Integer year, String make) {
        requireMembership(adult.id());
        int y = requireYear(year);
        String makeName = requireText(make, "make", 140);
        return vpicLookupService.listModels(makeName, y).stream()
                .map(VehicleModelResponse::new)
                .toList();
    }

    @Transactional
    public SuggestSeatsResponse suggestSeats(AdultResponse adult, SuggestSeatsRequest request) {
        requireMembership(adult.id());
        if (request == null) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "year, make, and model are required");
        }
        int year = requireYear(request.year());
        String make = requireText(request.make(), "make", 140);
        String model = requireText(request.model(), "model", 140);
        return new SuggestSeatsResponse(vpicLookupService.suggestSeats(year, make, model).orElse(null));
    }

    @Transactional
    public VehicleResponse create(AdultResponse adult, CreateVehicleRequest request) {
        FamilyMembershipEntity membership = requireMembership(adult.id());
        if (request == null) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "label, year, make, model, and seats are required");
        }
        String label = requireText(request.label(), "label", 80);
        String labelKey = label.toLowerCase(Locale.ROOT);
        int year = requireYear(request.year());
        String make = requireText(request.make(), "make", 140);
        String model = requireText(request.model(), "model", 140);
        int seats = requireSeats(request.seats());
        assertLabelAvailable(membership.circleId(), adult.id(), labelKey, null);
        FamilyVehicleEntity vehicle =
                new FamilyVehicleEntity(
                        UUID.randomUUID(),
                        membership.circleId(),
                        adult.id(),
                        label,
                        labelKey,
                        year,
                        make,
                        model,
                        seats,
                        Instant.now(clock));
        vehicle.setDriverAdultIds(normalizeDrivers(membership.circleId(), adult.id(), request.driverAdultIds()));
        vehicle.setKeptAtPlaceId(resolveKeptAt(membership, request.keptAtPlaceId(), true));
        vpicLookupService
                .suggestSeats(year, make, model)
                .ifPresent(vehicle::setSuggestedSeats);
        vehicles.save(vehicle);
        return toResponse(vehicle);
    }

    @Transactional
    public VehicleResponse update(AdultResponse adult, UUID vehicleId, UpdateVehicleRequest request) {
        FamilyMembershipEntity membership = requireMembership(adult.id());
        FamilyVehicleEntity vehicle = requireOwnedVehicle(membership.circleId(), adult.id(), vehicleId);
        if (request == null) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "label, year, make, model, and seats are required");
        }
        String label = requireText(request.label(), "label", 80);
        String labelKey = label.toLowerCase(Locale.ROOT);
        int year = requireYear(request.year());
        String make = requireText(request.make(), "make", 140);
        String model = requireText(request.model(), "model", 140);
        int seats = requireSeats(request.seats());
        assertLabelAvailable(membership.circleId(), adult.id(), labelKey, vehicle.id());
        vehicle.setLabel(label, labelKey);
        vehicle.setYear(year);
        vehicle.setMake(make);
        vehicle.setModel(model);
        vehicle.setSeats(seats);
        if (request.driverAdultIds() != null) {
            vehicle.setDriverAdultIds(
                    normalizeDrivers(membership.circleId(), adult.id(), request.driverAdultIds()));
        }
        vehicle.setKeptAtPlaceId(resolveKeptAt(membership, request.keptAtPlaceId(), false));
        vehicles.save(vehicle);
        return toResponse(vehicle);
    }

    @Transactional
    public void delete(AdultResponse adult, UUID vehicleId) {
        FamilyMembershipEntity membership = requireMembership(adult.id());
        FamilyVehicleEntity vehicle = requireOwnedVehicle(membership.circleId(), adult.id(), vehicleId);
        vehicles.delete(vehicle);
    }

    @Transactional
    public SuggestSeatsResponse suggestSeatsForVehicle(AdultResponse adult, UUID vehicleId) {
        FamilyMembershipEntity membership = requireMembership(adult.id());
        FamilyVehicleEntity vehicle =
                vehicles
                        .findByIdAndCircleId(vehicleId, membership.circleId())
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        Optional<Integer> hinted =
                vpicLookupService.suggestSeats(vehicle.year(), vehicle.make(), vehicle.model());
        hinted.ifPresent(
                seats -> {
                    if (vehicle.ownerAdultId().equals(adult.id())) {
                        vehicle.setSuggestedSeats(seats);
                        vehicles.save(vehicle);
                    }
                });
        return new SuggestSeatsResponse(hinted.orElse(null));
    }

    @Transactional
    public void removeAdult(UUID circleId, UUID adultId) {
        for (FamilyVehicleEntity owned : vehicles.findByCircleIdAndOwnerAdultId(circleId, adultId)) {
            vehicles.delete(owned);
        }
        for (FamilyVehicleEntity vehicle : vehicles.findByCircleIdOrderByCreatedAtAsc(circleId)) {
            if (vehicle.driverAdultIds().remove(adultId)) {
                vehicles.save(vehicle);
            }
        }
    }

    private GarageResponse snapshot(UUID circleId) {
        List<GarageMemberDrivesResponse> members =
                memberships.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(
                                membership -> {
                                    AdultResponse member = adultSessionApi.requireAdult(membership.adultId());
                                    return new GarageMemberDrivesResponse(
                                            member.id(), member.displayName(), membership.drives());
                                })
                        .toList();
        List<VehicleResponse> list =
                vehicles.findByCircleIdOrderByCreatedAtAsc(circleId).stream()
                        .map(this::toResponse)
                        .toList();
        return new GarageResponse(members, list);
    }

    private FamilyVehicleEntity requireOwnedVehicle(UUID circleId, UUID ownerId, UUID vehicleId) {
        FamilyVehicleEntity vehicle =
                vehicles
                        .findByIdAndCircleId(vehicleId, circleId)
                        .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        if (!vehicle.ownerAdultId().equals(ownerId)) {
            throw new FamilyException(HttpStatus.NOT_FOUND, "Vehicle not found");
        }
        return vehicle;
    }

    private Set<UUID> normalizeDrivers(UUID circleId, UUID ownerId, List<UUID> requested) {
        Set<UUID> ids = new LinkedHashSet<>();
        ids.add(ownerId);
        if (requested != null) {
            for (UUID id : requested) {
                if (id == null) {
                    continue;
                }
                ids.add(id);
            }
        }
        for (UUID id : ids) {
            if (memberships.findByCircleIdAndAdultId(circleId, id).isEmpty()) {
                throw new FamilyException(HttpStatus.BAD_REQUEST, "driverAdultIds must be circle members");
            }
        }
        if (!ids.contains(ownerId)) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "driverAdultIds must include the owner");
        }
        return ids;
    }

    private UUID resolveKeptAt(
            FamilyMembershipEntity membership, UUID requestedPlaceId, boolean creating) {
        UUID placeId = requestedPlaceId;
        if (placeId == null && creating) {
            placeId = membership.defaultLeaveFromPlaceId();
        }
        if (placeId == null) {
            return null;
        }
        if (places.findByIdAndCircleId(placeId, membership.circleId()).isEmpty()) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "keptAtPlaceId is not a place in this circle");
        }
        return placeId;
    }

    private void assertLabelAvailable(UUID circleId, UUID ownerId, String labelKey, UUID excludeId) {
        boolean taken =
                excludeId == null
                        ? vehicles.existsByCircleIdAndOwnerAdultIdAndLabelNormalized(
                                circleId, ownerId, labelKey)
                        : vehicles.existsByCircleIdAndOwnerAdultIdAndLabelNormalizedAndIdNot(
                                circleId, ownerId, labelKey, excludeId);
        if (taken) {
            throw new FamilyException(HttpStatus.CONFLICT, "Vehicle label already exists for this adult");
        }
    }

    private FamilyMembershipEntity requireMembership(UUID adultId) {
        return memberships
                .findByAdultId(adultId)
                .orElseThrow(() -> new FamilyException(HttpStatus.NOT_FOUND, "Family circle not found"));
    }

    private int requireYear(Integer year) {
        if (year == null) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "year is required");
        }
        int maxYear = Year.now(clock.withZone(ZoneOffset.UTC)).getValue() + 1;
        if (year < MIN_YEAR || year > maxYear) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "year is out of range");
        }
        return year;
    }

    private int requireSeats(Integer seats) {
        if (seats == null || seats < MIN_SEATS || seats > MAX_SEATS) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, "seats must be between 2 and 18");
        }
        return seats;
    }

    private static String requireText(String raw, String field, int max) {
        if (raw == null || raw.isBlank()) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, field + " must not be blank");
        }
        String trimmed = raw.trim();
        if (trimmed.length() > max) {
            throw new FamilyException(HttpStatus.BAD_REQUEST, field + " is too long");
        }
        return trimmed;
    }

    private VehicleResponse toResponse(FamilyVehicleEntity vehicle) {
        return new VehicleResponse(
                vehicle.id(),
                vehicle.ownerAdultId(),
                new ArrayList<>(vehicle.driverAdultIds()),
                vehicle.keptAtPlaceId(),
                vehicle.label(),
                vehicle.year(),
                vehicle.make(),
                vehicle.model(),
                vehicle.seats(),
                vehicle.suggestedSeats());
    }
}
