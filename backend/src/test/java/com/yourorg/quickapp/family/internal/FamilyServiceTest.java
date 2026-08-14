package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.CreateFamilyCircleRequest;
import com.yourorg.quickapp.family.FamilyRole;
import com.yourorg.quickapp.family.JoinFamilyCircleRequest;
import com.yourorg.quickapp.family.UpdateFamilyMemberRoleRequest;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class FamilyServiceTest {

    @Mock
    private AdultSessionApi adultSessionApi;

    @Mock
    private FamilyCircleRepository circles;

    @Mock
    private FamilyMembershipRepository memberships;

    @Mock
    private FamilyKidRepository kids;

    @Mock
    private FamilyPlaceRepository places;

    @Mock
    private GeocodeService geocodeService;

    @Mock
    private GarageService garageService;

    @InjectMocks
    private FamilyService familyService;

    @Test
    void createPersistsOrganizerMembershipInviteAndSetsDisplayName() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", null);
        when(memberships.existsByAdultId(adultId)).thenReturn(false);
        when(circles.existsByInviteCode(any())).thenReturn(false);
        when(circles.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(any()))
                .thenAnswer(
                        inv -> {
                            UUID circleId = inv.getArgument(0);
                            return List.of(
                                    new FamilyMembershipEntity(
                                            UUID.randomUUID(),
                                            circleId,
                                            adultId,
                                            FamilyRole.ORGANIZER,
                                            Instant.now()));
                        });
        when(kids.findByCircleIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
        when(places.findByCircleIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
        when(adultSessionApi.requireAdult(adultId))
                .thenReturn(new AdultResponse(adultId, "a@example.com", "Alex"));

        var response =
                familyService.create(adult, new CreateFamilyCircleRequest("Alex", "Our house"));

        assertThat(response.role()).isEqualTo(FamilyRole.ORGANIZER);
        assertThat(response.name()).isEqualTo("Our house");
        assertThat(response.kids()).isEmpty();
        assertThat(response.places()).isEmpty();
        assertThat(response.members()).hasSize(1);
        assertThat(response.members().getFirst().role()).isEqualTo(FamilyRole.ORGANIZER);
        verify(adultSessionApi).updateDisplayName(adultId, "Alex");

        ArgumentCaptor<FamilyCircleEntity> circle = ArgumentCaptor.forClass(FamilyCircleEntity.class);
        verify(circles).save(circle.capture());
        assertThat(circle.getValue().inviteCode()).isNotBlank();

        ArgumentCaptor<FamilyMembershipEntity> membership =
                ArgumentCaptor.forClass(FamilyMembershipEntity.class);
        verify(memberships).save(membership.capture());
        assertThat(membership.getValue().adultId()).isEqualTo(adultId);
        assertThat(membership.getValue().role()).isEqualTo(FamilyRole.ORGANIZER);
    }

    @Test
    void createConflictsWhenAdultAlreadyHasCircle() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", null);
        when(memberships.existsByAdultId(adultId)).thenReturn(true);

        assertThatThrownBy(
                        () ->
                                familyService.create(
                                        adult, new CreateFamilyCircleRequest("Alex", null)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void getWithoutMembershipReturnsNotFound() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        when(memberships.findByAdultId(adultId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> familyService.get(adult))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void joinAsCaregiverWithValidCode() {
        UUID organizerId = UUID.randomUUID();
        UUID joinerId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse joiner = new AdultResponse(joinerId, "b@example.com", null);
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, "House", "AB12CD34", Instant.now());

        when(memberships.existsByAdultId(joinerId)).thenReturn(false);
        when(circles.findByInviteCode("AB12CD34")).thenReturn(Optional.of(circle));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId))
                .thenReturn(
                        List.of(
                                new FamilyMembershipEntity(
                                        UUID.randomUUID(),
                                        circleId,
                                        organizerId,
                                        FamilyRole.ORGANIZER,
                                        Instant.now()),
                                new FamilyMembershipEntity(
                                        UUID.randomUUID(),
                                        circleId,
                                        joinerId,
                                        FamilyRole.CAREGIVER,
                                        Instant.now())));
        when(kids.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());
        when(places.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());
        when(adultSessionApi.requireAdult(organizerId))
                .thenReturn(new AdultResponse(organizerId, "a@example.com", "Alex"));
        when(adultSessionApi.requireAdult(joinerId))
                .thenReturn(new AdultResponse(joinerId, "b@example.com", "Jordan"));

        var response =
                familyService.join(joiner, new JoinFamilyCircleRequest("ab12cd34", "Jordan"));

        assertThat(response.role()).isEqualTo(FamilyRole.CAREGIVER);
        assertThat(response.members()).hasSize(2);
        assertThat(response.places()).isEmpty();
        verify(adultSessionApi).updateDisplayName(joinerId, "Jordan");
        ArgumentCaptor<FamilyMembershipEntity> membership =
                ArgumentCaptor.forClass(FamilyMembershipEntity.class);
        verify(memberships).save(membership.capture());
        assertThat(membership.getValue().role()).isEqualTo(FamilyRole.CAREGIVER);
    }

    @Test
    void joinConflictsWhenAlreadyAMember() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "b@example.com", "Jordan");
        when(memberships.existsByAdultId(adultId)).thenReturn(true);

        assertThatThrownBy(
                        () -> familyService.join(adult, new JoinFamilyCircleRequest("AB12CD34", null)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(circles, never()).findByInviteCode(any());
    }

    @Test
    void demoteLastOrganizerConflicts() {
        UUID organizerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse organizer = new AdultResponse(organizerId, "a@example.com", "Alex");
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());
        FamilyMembershipEntity organizerMembership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, organizerId, FamilyRole.ORGANIZER, Instant.now());
        FamilyMembershipEntity otherMembership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, otherId, FamilyRole.ORGANIZER, Instant.now());

        when(memberships.findByAdultId(organizerId)).thenReturn(Optional.of(organizerMembership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(memberships.findByCircleIdAndAdultId(circleId, otherId))
                .thenReturn(Optional.of(otherMembership));
        when(memberships.countByCircleIdAndRole(circleId, FamilyRole.ORGANIZER)).thenReturn(1L);

        assertThatThrownBy(
                        () ->
                                familyService.updateMemberRole(
                                        organizer,
                                        otherId,
                                        new UpdateFamilyMemberRoleRequest(FamilyRole.CAREGIVER)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void caregiverCannotManageKids() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "b@example.com", "Jordan");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.CAREGIVER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));

        assertThatThrownBy(
                        () ->
                                familyService.addKid(
                                        adult, new com.yourorg.quickapp.family.CreateKidRequest("Sam")))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void removeLastOrganizerConflicts() {
        UUID organizerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse organizer = new AdultResponse(organizerId, "a@example.com", "Alex");
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());
        FamilyMembershipEntity organizerMembership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, organizerId, FamilyRole.ORGANIZER, Instant.now());
        FamilyMembershipEntity otherMembership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, otherId, FamilyRole.ORGANIZER, Instant.now());

        when(memberships.findByAdultId(organizerId)).thenReturn(Optional.of(organizerMembership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(memberships.findByCircleIdAndAdultId(circleId, otherId))
                .thenReturn(Optional.of(otherMembership));
        when(memberships.countByCircleIdAndRole(circleId, FamilyRole.ORGANIZER)).thenReturn(1L);

        assertThatThrownBy(() -> familyService.removeMember(organizer, otherId))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void soleOrganizerCannotLeaveWhileKidsRemain() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(memberships.countByCircleId(circleId)).thenReturn(1L);
        when(memberships.countByCircleIdAndRole(circleId, FamilyRole.ORGANIZER)).thenReturn(1L);
        when(kids.countByCircleId(circleId)).thenReturn(1L);

        assertThatThrownBy(() -> familyService.leave(adult))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void soleOrganizerLeavesEmptyCircle() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(memberships.countByCircleId(circleId)).thenReturn(1L);
        when(memberships.countByCircleIdAndRole(circleId, FamilyRole.ORGANIZER)).thenReturn(1L);
        when(kids.countByCircleId(circleId)).thenReturn(0L);

        familyService.leave(adult);

        verify(memberships).delete(membership);
        verify(circles).delete(circle);
    }

    @Test
    void caregiverCanAddPlace() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "b@example.com", "Jordan");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.CAREGIVER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.existsByCircleIdAndNameNormalized(circleId, "mom's house")).thenReturn(false);
        when(places.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(geocodeService.resolve("123 Main St"))
                .thenReturn(Optional.of(new GeoCoordinates(40.1, -74.2)));

        var response =
                familyService.addPlace(
                        adult,
                        new com.yourorg.quickapp.family.CreatePlaceRequest(
                                "Mom's house", "123 Main St"));

        assertThat(response.name()).isEqualTo("Mom's house");
        assertThat(response.address()).isEqualTo("123 Main St");
        assertThat(response.latitude()).isEqualTo(40.1);
        assertThat(response.longitude()).isEqualTo(-74.2);
        ArgumentCaptor<FamilyPlaceEntity> place = ArgumentCaptor.forClass(FamilyPlaceEntity.class);
        verify(places).save(place.capture());
        assertThat(place.getValue().nameNormalized()).isEqualTo("mom's house");
        assertThat(place.getValue().circleId()).isEqualTo(circleId);
        assertThat(place.getValue().latitude()).isEqualTo(40.1);
    }

    @Test
    void addPlaceSoftFailsWhenGeocodeMisses() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.existsByCircleIdAndNameNormalized(circleId, "mystery")).thenReturn(false);
        when(places.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(geocodeService.resolve("Unlocateable Rd")).thenReturn(Optional.empty());

        var response =
                familyService.addPlace(
                        adult,
                        new com.yourorg.quickapp.family.CreatePlaceRequest(
                                "Mystery", "Unlocateable Rd"));

        assertThat(response.latitude()).isNull();
        assertThat(response.longitude()).isNull();
        verify(places).save(any());
    }

    @Test
    void updatePlaceNameOnlySkipsGeocodeWhenCoordsPresent() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());
        FamilyPlaceEntity place =
                new FamilyPlaceEntity(
                        placeId, circleId, "School", "school", "1 School Rd", Instant.now());
        place.setCoordinates(41.0, -73.5);

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.findByIdAndCircleId(placeId, circleId)).thenReturn(Optional.of(place));
        when(places.existsByCircleIdAndNameNormalizedAndIdNot(circleId, "elementary", placeId))
                .thenReturn(false);
        when(places.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response =
                familyService.updatePlace(
                        adult,
                        placeId,
                        new com.yourorg.quickapp.family.UpdatePlaceRequest(
                                "Elementary", "1 School Rd"));

        assertThat(response.name()).isEqualTo("Elementary");
        assertThat(response.latitude()).isEqualTo(41.0);
        assertThat(response.longitude()).isEqualTo(-73.5);
        verify(geocodeService, never()).resolve(any());
    }

    @Test
    void locatePlaceAppliesGeocode() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());
        FamilyPlaceEntity place =
                new FamilyPlaceEntity(
                        placeId, circleId, "School", "school", "1 School Rd", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.findByIdAndCircleId(placeId, circleId)).thenReturn(Optional.of(place));
        when(places.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(geocodeService.resolve("1 School Rd"))
                .thenReturn(Optional.of(new GeoCoordinates(40.5, -74.1)));

        var response = familyService.locatePlace(adult, placeId);

        assertThat(response.latitude()).isEqualTo(40.5);
        assertThat(response.longitude()).isEqualTo(-74.1);
    }

    @Test
    void duplicatePlaceNameConflictsCaseInsensitive() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.existsByCircleIdAndNameNormalized(circleId, "school")).thenReturn(true);

        assertThatThrownBy(
                        () ->
                                familyService.addPlace(
                                        adult,
                                        new com.yourorg.quickapp.family.CreatePlaceRequest(
                                                "School", "1 School Rd")))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(places, never()).save(any());
    }

    @Test
    void updatePlaceAllowsSameNormalizedNameForSelf() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());
        FamilyPlaceEntity place =
                new FamilyPlaceEntity(
                        placeId, circleId, "School", "school", "1 School Rd", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.findByIdAndCircleId(placeId, circleId)).thenReturn(Optional.of(place));
        when(places.existsByCircleIdAndNameNormalizedAndIdNot(circleId, "school", placeId))
                .thenReturn(false);
        when(places.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(geocodeService.resolve("2 School Rd"))
                .thenReturn(Optional.of(new GeoCoordinates(40.2, -74.3)));

        var response =
                familyService.updatePlace(
                        adult,
                        placeId,
                        new com.yourorg.quickapp.family.UpdatePlaceRequest(
                                "school", "2 School Rd"));

        assertThat(response.name()).isEqualTo("school");
        assertThat(response.address()).isEqualTo("2 School Rd");
        assertThat(response.latitude()).isEqualTo(40.2);
        assertThat(response.longitude()).isEqualTo(-74.3);
    }

    @Test
    void blankPlaceAddressRejected() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));

        assertThatThrownBy(
                        () ->
                                familyService.addPlace(
                                        adult,
                                        new com.yourorg.quickapp.family.CreatePlaceRequest(
                                                "School", "   ")))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void setDefaultLeaveFromPersistsLocatedPlace() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, "Our house", "AB12CD34", Instant.now());
        FamilyPlaceEntity place =
                new FamilyPlaceEntity(
                        placeId, circleId, "Home", "home", "1 Home Rd", Instant.now());
        place.setCoordinates(40.0, -74.0);

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.findByIdAndCircleId(placeId, circleId)).thenReturn(Optional.of(place));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(membership));
        when(kids.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());
        when(places.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(place));
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);

        var response =
                familyService.setDefaultLeaveFrom(
                        adult, new com.yourorg.quickapp.family.SetDefaultLeaveFromRequest(placeId));

        assertThat(response.defaultLeaveFromPlaceId()).isEqualTo(placeId);
        assertThat(response.defaultLeaveFromPlaceName()).isEqualTo("Home");
        assertThat(membership.defaultLeaveFromPlaceId()).isEqualTo(placeId);
        verify(memberships).save(membership);
    }

    @Test
    void setDefaultLeaveFromRejectsUnlocatedPlace() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());
        FamilyPlaceEntity place =
                new FamilyPlaceEntity(
                        placeId, circleId, "Home", "home", "1 Home Rd", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(places.findByIdAndCircleId(placeId, circleId)).thenReturn(Optional.of(place));

        assertThatThrownBy(
                        () ->
                                familyService.setDefaultLeaveFrom(
                                        adult,
                                        new com.yourorg.quickapp.family.SetDefaultLeaveFromRequest(
                                                placeId)))
                .isInstanceOf(FamilyException.class)
                .extracting(ex -> ((FamilyException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(memberships, never()).save(any());
    }

    @Test
    void setDefaultLeaveFromClearsWhenPlaceIdNull() {
        UUID adultId = UUID.randomUUID();
        UUID circleId = UUID.randomUUID();
        UUID placeId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", "Alex");
        FamilyMembershipEntity membership =
                new FamilyMembershipEntity(
                        UUID.randomUUID(), circleId, adultId, FamilyRole.ORGANIZER, Instant.now());
        membership.setDefaultLeaveFromPlaceId(placeId);
        FamilyCircleEntity circle =
                new FamilyCircleEntity(circleId, null, "AB12CD34", Instant.now());

        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(membership));
        when(circles.findById(circleId)).thenReturn(Optional.of(circle));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of(membership));
        when(kids.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());
        when(places.findByCircleIdOrderByCreatedAtAsc(circleId)).thenReturn(List.of());
        when(adultSessionApi.requireAdult(adultId)).thenReturn(adult);

        var response =
                familyService.setDefaultLeaveFrom(
                        adult, new com.yourorg.quickapp.family.SetDefaultLeaveFromRequest(null));

        assertThat(response.defaultLeaveFromPlaceId()).isNull();
        assertThat(membership.defaultLeaveFromPlaceId()).isNull();
    }
}
