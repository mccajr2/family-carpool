package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.CreateVehicleRequest;
import com.yourorg.quickapp.family.FamilyRole;
import com.yourorg.quickapp.family.PatchGarageDrivesRequest;
import com.yourorg.quickapp.family.UpdateVehicleRequest;
import com.yourorg.quickapp.family.VehicleResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class GarageServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-14T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Mock
    private AdultSessionApi adultSessionApi;

    @Mock
    private FamilyMembershipRepository memberships;

    @Mock
    private FamilyCircleRepository circles;

    @Mock
    private FamilyPlaceRepository places;

    @Mock
    private FamilyVehicleRepository vehicles;

    @Mock
    private VpicLookupService vpicLookupService;

    private GarageService garageService;

    private final UUID momId = UUID.randomUUID();
    private final UUID dadId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID placeId = UUID.randomUUID();
    private final AdultResponse mom = new AdultResponse(momId, "mom@example.com", "Mom");
    private final AdultResponse dad = new AdultResponse(dadId, "dad@example.com", "Dad");

    @BeforeEach
    void setUp() {
        garageService =
                new GarageService(
                        adultSessionApi,
                        memberships,
                        circles,
                        places,
                        vehicles,
                        vpicLookupService,
                        CLOCK);
    }

    @Test
    void createDefaultsDriversToOwnerAndKeptAtToDefaultLeaveFrom() {
        FamilyMembershipEntity membership = membership(momId, FamilyRole.ORGANIZER);
        membership.setDefaultLeaveFromPlaceId(placeId);
        when(memberships.findByAdultId(momId)).thenReturn(Optional.of(membership));
        when(memberships.findByCircleIdAndAdultId(circleId, momId))
                .thenReturn(Optional.of(membership));
        when(places.findByIdAndCircleId(placeId, circleId))
                .thenReturn(Optional.of(place(placeId)));
        when(vehicles.existsByCircleIdAndOwnerAdultIdAndLabelNormalized(circleId, momId, "blue van"))
                .thenReturn(false);
        when(vpicLookupService.suggestSeats(2020, "HONDA", "Odyssey")).thenReturn(Optional.of(8));
        when(vehicles.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleResponse created =
                garageService.create(
                        mom,
                        new CreateVehicleRequest(
                                "Blue van", 2020, "HONDA", "Odyssey", 7, null, null));

        assertThat(created.ownerAdultId()).isEqualTo(momId);
        assertThat(created.driverAdultIds()).containsExactly(momId);
        assertThat(created.keptAtPlaceId()).isEqualTo(placeId);
        assertThat(created.seats()).isEqualTo(7);
        assertThat(created.suggestedSeats()).isEqualTo(8);

        ArgumentCaptor<FamilyVehicleEntity> saved = ArgumentCaptor.forClass(FamilyVehicleEntity.class);
        verify(vehicles).save(saved.capture());
        assertThat(saved.getValue().driverAdultIds()).containsExactly(momId);
    }

    @Test
    void createCanAddAnotherCircleMemberAsDriver() {
        FamilyMembershipEntity momMem = membership(momId, FamilyRole.ORGANIZER);
        FamilyMembershipEntity dadMem = membership(dadId, FamilyRole.CAREGIVER);
        when(memberships.findByAdultId(momId)).thenReturn(Optional.of(momMem));
        when(memberships.findByCircleIdAndAdultId(circleId, momId)).thenReturn(Optional.of(momMem));
        when(memberships.findByCircleIdAndAdultId(circleId, dadId)).thenReturn(Optional.of(dadMem));
        when(vehicles.existsByCircleIdAndOwnerAdultIdAndLabelNormalized(any(), any(), any()))
                .thenReturn(false);
        when(vpicLookupService.suggestSeats(anyInt(), any(), any()))
                .thenReturn(Optional.empty());
        when(vehicles.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleResponse created =
                garageService.create(
                        mom,
                        new CreateVehicleRequest(
                                "Van", 2020, "HONDA", "Odyssey", 8, List.of(dadId), null));

        assertThat(created.driverAdultIds()).containsExactlyInAnyOrder(momId, dadId);
    }

    @Test
    void createRejectsNonMemberDriver() {
        FamilyMembershipEntity momMem = membership(momId, FamilyRole.ORGANIZER);
        when(memberships.findByAdultId(momId)).thenReturn(Optional.of(momMem));
        when(memberships.findByCircleIdAndAdultId(circleId, momId)).thenReturn(Optional.of(momMem));
        when(memberships.findByCircleIdAndAdultId(circleId, dadId)).thenReturn(Optional.empty());
        when(vehicles.existsByCircleIdAndOwnerAdultIdAndLabelNormalized(any(), any(), any()))
                .thenReturn(false);

        assertThatThrownBy(
                        () ->
                                garageService.create(
                                        mom,
                                        new CreateVehicleRequest(
                                                "Van",
                                                2020,
                                                "HONDA",
                                                "Odyssey",
                                                8,
                                                List.of(dadId),
                                                null)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createConflictsOnDuplicateLabelForOwner() {
        when(memberships.findByAdultId(momId))
                .thenReturn(Optional.of(membership(momId, FamilyRole.ORGANIZER)));
        when(vehicles.existsByCircleIdAndOwnerAdultIdAndLabelNormalized(circleId, momId, "van"))
                .thenReturn(true);

        assertThatThrownBy(
                        () ->
                                garageService.create(
                                        mom,
                                        new CreateVehicleRequest(
                                                "Van", 2020, "HONDA", "Odyssey", 8, null, null)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createRejectsSeatsOutOfRange() {
        when(memberships.findByAdultId(momId))
                .thenReturn(Optional.of(membership(momId, FamilyRole.ORGANIZER)));

        assertThatThrownBy(
                        () ->
                                garageService.create(
                                        mom,
                                        new CreateVehicleRequest(
                                                "Van", 2020, "HONDA", "Odyssey", 1, null, null)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void nonOwnerUpdateIsNotFound() {
        FamilyVehicleEntity van = ownedVan();
        when(memberships.findByAdultId(dadId))
                .thenReturn(Optional.of(membership(dadId, FamilyRole.CAREGIVER)));
        when(vehicles.findByIdAndCircleId(van.id(), circleId)).thenReturn(Optional.of(van));

        assertThatThrownBy(
                        () ->
                                garageService.update(
                                        dad,
                                        van.id(),
                                        new UpdateVehicleRequest(
                                                "Van", 2020, "HONDA", "Odyssey", 8, null, null)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void patchDrivesDoesNotDeleteVehicles() {
        FamilyMembershipEntity membership = membership(momId, FamilyRole.ORGANIZER);
        when(memberships.findByAdultId(momId)).thenReturn(Optional.of(membership));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(membership));
        when(adultSessionApi.requireAdult(momId)).thenReturn(mom);
        when(vehicles.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(ownedVan()));

        var garage = garageService.patchDrives(mom, new PatchGarageDrivesRequest(false));

        assertThat(membership.drives()).isFalse();
        assertThat(garage.vehicles()).hasSize(1);
        verify(vehicles, org.mockito.Mockito.never()).delete(any());
    }

    @Test
    void removeAdultDeletesOwnedAndUnassignsAsDriver() {
        FamilyVehicleEntity owned = ownedVan();
        FamilyVehicleEntity shared = ownedVan();
        shared.setDriverAdultIds(Set.of(shared.ownerAdultId(), dadId));
        when(vehicles.findByCircleIdAndOwnerAdultId(circleId, dadId)).thenReturn(List.of());
        when(vehicles.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(owned, shared));

        garageService.removeAdult(circleId, dadId);

        verify(vehicles, org.mockito.Mockito.never()).delete(owned);
        verify(vehicles).save(shared);
        assertThat(shared.driverAdultIds()).doesNotContain(dadId);
    }

    @Test
    void removeAdultDeletesVehiclesTheyOwn() {
        FamilyVehicleEntity owned = ownedVan();
        when(vehicles.findByCircleIdAndOwnerAdultId(circleId, momId)).thenReturn(List.of(owned));
        when(vehicles.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());

        garageService.removeAdult(circleId, momId);

        verify(vehicles).delete(owned);
    }

    private FamilyMembershipEntity membership(UUID adultId, FamilyRole role) {
        return new FamilyMembershipEntity(
                UUID.randomUUID(), circleId, adultId, role, Instant.now());
    }

    private FamilyPlaceEntity place(UUID id) {
        return new FamilyPlaceEntity(
                id, circleId, "Home", "home", "1 Main", Instant.now());
    }

    private FamilyVehicleEntity ownedVan() {
        return new FamilyVehicleEntity(
                UUID.randomUUID(),
                circleId,
                momId,
                "Van",
                "van",
                2020,
                "HONDA",
                "Odyssey",
                8,
                Instant.now());
    }
}
