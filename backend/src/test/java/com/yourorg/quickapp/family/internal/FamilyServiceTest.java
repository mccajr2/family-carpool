package com.yourorg.quickapp.family.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import com.yourorg.quickapp.family.CreateFamilyCircleRequest;
import com.yourorg.quickapp.family.FamilyRole;
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

    @InjectMocks
    private FamilyService familyService;

    @Test
    void createPersistsOrganizerMembershipAndSetsDisplayName() {
        UUID adultId = UUID.randomUUID();
        AdultResponse adult = new AdultResponse(adultId, "a@example.com", null);
        when(memberships.existsByAdultId(adultId)).thenReturn(false);
        when(circles.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response =
                familyService.create(adult, new CreateFamilyCircleRequest("Alex", "Our house"));

        assertThat(response.role()).isEqualTo(FamilyRole.ORGANIZER);
        assertThat(response.name()).isEqualTo("Our house");
        assertThat(response.kids()).isEmpty();
        verify(adultSessionApi).updateDisplayName(adultId, "Alex");

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
}
