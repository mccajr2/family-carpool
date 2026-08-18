package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyCircleName;
import com.yourorg.quickapp.family.FamilyKidName;
import com.yourorg.quickapp.family.FamilyRole;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FamilyMembershipApiImplTest {

    @Mock
    private FamilyMembershipRepository memberships;

    @Mock
    private FamilyCircleRepository circles;

    @Mock
    private FamilyKidRepository kids;

    private FamilyMembershipApiImpl api;

    private final UUID namedId = UUID.fromString("01900000-0000-7000-8000-000000000010");
    private final UUID unnamedId = UUID.fromString("01900000-0000-7000-8000-000000000011");
    private final UUID missingId = UUID.fromString("01900000-0000-7000-8000-000000000099");

    @BeforeEach
    void setUp() {
        api = new FamilyMembershipApiImpl(memberships, circles, kids);
    }

    @Test
    void findCircleReturnsNameWhenPresent() {
        when(circles.findById(namedId)).thenReturn(Optional.of(circle(namedId, "McCarthy house")));

        assertThat(api.findCircle(namedId))
                .contains(new FamilyCircleName(namedId, "McCarthy house"));
    }

    @Test
    void findCircleAllowsNullName() {
        when(circles.findById(unnamedId)).thenReturn(Optional.of(circle(unnamedId, null)));

        Optional<FamilyCircleName> found = api.findCircle(unnamedId);

        assertThat(found).isPresent();
        assertThat(found.get().id()).isEqualTo(unnamedId);
        assertThat(found.get().name()).isNull();
    }

    @Test
    void findCircleEmptyWhenMissingOrNullId() {
        when(circles.findById(missingId)).thenReturn(Optional.empty());

        assertThat(api.findCircle(missingId)).isEmpty();
        assertThat(api.findCircle(null)).isEmpty();
    }

    @Test
    void findCirclesSkipsUnknownPreservesRequestedOrderAndCollapsesDuplicates() {
        when(circles.findAllById(List.of(unnamedId, missingId, namedId)))
                .thenReturn(List.of(circle(namedId, "House"), circle(unnamedId, null)));

        List<FamilyCircleName> found =
                api.findCircles(List.of(unnamedId, missingId, namedId, unnamedId));

        assertThat(found)
                .containsExactly(
                        new FamilyCircleName(unnamedId, null),
                        new FamilyCircleName(namedId, "House"));
        verify(circles).findAllById(List.of(unnamedId, missingId, namedId));
    }

    @Test
    void findCirclesEmptyWhenNullOrEmpty() {
        assertThat(api.findCircles(null)).isEmpty();
        assertThat(api.findCircles(List.of())).isEmpty();
    }

    @Test
    void findKidsReturnsDisplayNamesInRequestedOrderAndSkipsUnknown() {
        UUID otherCircle = UUID.fromString("01900000-0000-7000-8000-000000000012");
        UUID samId = UUID.fromString("01900000-0000-7000-8000-000000000021");
        UUID jordanId = UUID.fromString("01900000-0000-7000-8000-000000000022");
        UUID otherKidId = UUID.fromString("01900000-0000-7000-8000-000000000023");
        FamilyKidEntity sam = kid(samId, namedId, "Sam");
        FamilyKidEntity jordan = kid(jordanId, namedId, "Jordan");
        FamilyKidEntity other = kid(otherKidId, otherCircle, "Other");
        when(kids.findAllById(List.of(jordanId, missingId, samId, otherKidId)))
                .thenReturn(List.of(sam, jordan, other));

        List<FamilyKidName> found =
                api.findKids(
                        namedId, List.of(jordanId, missingId, samId, jordanId, otherKidId));

        assertThat(found)
                .containsExactly(new FamilyKidName(jordanId, "Jordan"), new FamilyKidName(samId, "Sam"));
        verify(kids).findAllById(List.of(jordanId, missingId, samId, otherKidId));
    }

    @Test
    void findKidsEmptyWhenNullCircleOrEmptyIds() {
        assertThat(api.findKids(null, List.of(namedId))).isEmpty();
        assertThat(api.findKids(namedId, null)).isEmpty();
        assertThat(api.findKids(namedId, List.of())).isEmpty();
    }

    @Test
    void requireMemberRoleReturnsOrganizerAndCaregiver() {
        UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000001");
        FamilyMembershipEntity organizer =
                new FamilyMembershipEntity(
                        UUID.randomUUID(),
                        namedId,
                        adultId,
                        FamilyRole.ORGANIZER,
                        Instant.parse("2026-08-01T00:00:00Z"));
        when(memberships.findByAdultId(adultId)).thenReturn(Optional.of(organizer));
        when(circles.findById(namedId)).thenReturn(Optional.of(circle(namedId, "House")));

        assertThat(api.requireMemberRole(adultId)).isEqualTo(FamilyRole.ORGANIZER);
    }

    @Test
    void requireMemberRole404WhenNoCircle() {
        UUID adultId = UUID.fromString("01900000-0000-7000-8000-000000000002");
        when(memberships.findByAdultId(adultId)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> api.requireMemberRole(adultId))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(org.springframework.http.HttpStatus.NOT_FOUND);
    }

    private static FamilyCircleEntity circle(UUID id, String name) {
        return new FamilyCircleEntity(id, name, "AB12CD34", Instant.parse("2026-08-01T00:00:00Z"));
    }

    private static FamilyKidEntity kid(UUID id, UUID circleId, String displayName) {
        return new FamilyKidEntity(id, circleId, displayName, Instant.parse("2026-08-01T00:00:00Z"));
    }
}
