package com.yourorg.quickapp.coverage.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yourorg.quickapp.coverage.CoverageAssignmentDto;
import com.yourorg.quickapp.coverage.CoverageItemSource;
import com.yourorg.quickapp.coverage.CoverageStatus;
import com.yourorg.quickapp.events.ManualCalendarEventDto;
import com.yourorg.quickapp.events.ManualEventCalendarApi;
import com.yourorg.quickapp.family.FamilyAccessException;
import com.yourorg.quickapp.family.FamilyMembershipApi;
import com.yourorg.quickapp.feeds.FeedCalendarApi;
import java.time.Instant;
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
class CoverageApiImplTest {

    @Mock
    private FamilyMembershipApi membershipApi;

    @Mock
    private ManualEventCalendarApi manualEventCalendarApi;

    @Mock
    private FeedCalendarApi feedCalendarApi;

    @Mock
    private CoverageAssignmentRepository assignments;

    private CoverageApiImpl api;

    private final UUID actorId = UUID.randomUUID();
    private final UUID otherAdultId = UUID.randomUUID();
    private final UUID circleId = UUID.randomUUID();
    private final UUID itemId = UUID.randomUUID();
    private final UUID kidA = UUID.randomUUID();
    private final UUID kidB = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        api =
                new CoverageApiImpl(
                        membershipApi, manualEventCalendarApi, feedCalendarApi, assignments);
        lenient()
                .when(assignments.findByCircleIdAndCoveringAdultIdAndStatus(any(), any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void assignSelfIsConfirmed() {
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA, kidB));
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(actorId),
                        any()))
                .thenReturn(Optional.empty());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of());
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result =
                api.assign(
                        actorId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        List.of(kidA, kidB));

        assertThat(result.status()).isEqualTo(CoverageStatus.CONFIRMED);
        assertThat(result.coveringAdultId()).isEqualTo(actorId);
        assertThat(result.kidIds()).containsExactlyInAnyOrder(kidA, kidB);
        verify(membershipApi).requireAdultInCircle(circleId, actorId);
        verify(membershipApi).requireKidsInCircle(eq(circleId), any());
    }

    @Test
    void assignOtherIsPending() {
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA));
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(otherAdultId),
                        any()))
                .thenReturn(Optional.empty());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of());
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result =
                api.assign(
                        actorId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        otherAdultId,
                        List.of(kidA));

        assertThat(result.status()).isEqualTo(CoverageStatus.PENDING);
        assertThat(result.coveringAdultId()).isEqualTo(otherAdultId);
        assertThat(result.assignedByAdultId()).isEqualTo(actorId);
    }

    @Test
    void assignConflictsWhenKidAlreadyCovered() {
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA, kidB));
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(actorId),
                        any()))
                .thenReturn(Optional.empty());
        CoverageAssignmentEntity other =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        otherAdultId,
                        otherAdultId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of(other));

        assertThatThrownBy(
                        () ->
                                api.assign(
                                        actorId,
                                        CoverageItemSource.MANUAL,
                                        itemId,
                                        actorId,
                                        List.of(kidA)))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(assignments, never()).save(any());
    }

    @Test
    void assignRejectsKidNotOnItem() {
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA));

        assertThatThrownBy(
                        () ->
                                api.assign(
                                        actorId,
                                        CoverageItemSource.MANUAL,
                                        itemId,
                                        actorId,
                                        List.of(kidB)))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void confirmOnlyByAssignee() {
        UUID assignmentId = UUID.randomUUID();
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        assignmentId,
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        otherAdultId,
                        actorId,
                        CoverageStatus.PENDING,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        when(assignments.findById(assignmentId)).thenReturn(Optional.of(row));

        assertThatThrownBy(() -> api.confirm(actorId, assignmentId))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void confirmPendingByAssignee() {
        UUID assignmentId = UUID.randomUUID();
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        assignmentId,
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        otherAdultId,
                        actorId,
                        CoverageStatus.PENDING,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(otherAdultId)).thenReturn(circleId);
        when(assignments.findById(assignmentId)).thenReturn(Optional.of(row));
        stubManualItem(List.of(kidA));
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result = api.confirm(otherAdultId, assignmentId);

        assertThat(result.status()).isEqualTo(CoverageStatus.CONFIRMED);
    }

    @Test
    void confirmConflictsWhenAdultAlreadyConfirmedOnOverlappingItem() {
        UUID assignmentId = UUID.randomUUID();
        UUID otherItemId = UUID.randomUUID();
        CoverageAssignmentEntity pending =
                new CoverageAssignmentEntity(
                        assignmentId,
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        otherAdultId,
                        CoverageStatus.PENDING,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        CoverageAssignmentEntity confirmedOther =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.MANUAL,
                        otherItemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidB),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        when(assignments.findById(assignmentId)).thenReturn(Optional.of(pending));
        stubManualItem(List.of(kidA));
        when(manualEventCalendarApi.findInCircle(circleId, otherItemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        otherItemId,
                                        "Other",
                                        Instant.parse("2026-08-15T17:30:00Z"),
                                        Instant.parse("2026-08-15T18:30:00Z"),
                                        "Field",
                                        List.of(kidB))));
        when(assignments.findByCircleIdAndCoveringAdultIdAndStatus(
                        circleId, actorId, CoverageStatus.CONFIRMED))
                .thenReturn(List.of(confirmedOther));

        assertThatThrownBy(() -> api.confirm(actorId, assignmentId))
                .isInstanceOf(FamilyAccessException.class)
                .satisfies(
                        ex -> {
                            FamilyAccessException access = (FamilyAccessException) ex;
                            assertThat(access.status()).isEqualTo(HttpStatus.CONFLICT);
                            assertThat(access.getMessage())
                                    .contains("already confirmed on an overlapping");
                        });
        verify(assignments, never()).save(any());
    }

    @Test
    void selfAssignConflictsWhenAdultAlreadyConfirmedOnOverlappingItem() {
        UUID otherItemId = UUID.randomUUID();
        CoverageAssignmentEntity confirmedOther =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.MANUAL,
                        otherItemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidB),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA));
        when(manualEventCalendarApi.findInCircle(circleId, otherItemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        otherItemId,
                                        "Other",
                                        Instant.parse("2026-08-15T17:30:00Z"),
                                        Instant.parse("2026-08-15T18:30:00Z"),
                                        "Field",
                                        List.of(kidB))));
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(actorId),
                        any()))
                .thenReturn(Optional.empty());
        when(assignments.findByCircleIdAndCoveringAdultIdAndStatus(
                        circleId, actorId, CoverageStatus.CONFIRMED))
                .thenReturn(List.of(confirmedOther));

        assertThatThrownBy(
                        () ->
                                api.assign(
                                        actorId,
                                        CoverageItemSource.MANUAL,
                                        itemId,
                                        actorId,
                                        List.of(kidA)))
                .isInstanceOf(FamilyAccessException.class)
                .extracting(ex -> ((FamilyAccessException) ex).status())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(assignments, never()).save(any());
    }

    @Test
    void selfAssignIgnoresStaleConfirmedCoverageWhoseItemWasDeleted() {
        UUID missingFeedItemId = UUID.randomUUID();
        CoverageAssignmentEntity staleConfirmed =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.FEED,
                        missingFeedItemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidB),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA));
        when(feedCalendarApi.findEventInCircle(circleId, missingFeedItemId))
                .thenReturn(Optional.empty());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(actorId),
                        any()))
                .thenReturn(Optional.empty());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of());
        when(assignments.findByCircleIdAndCoveringAdultIdAndStatus(
                        circleId, actorId, CoverageStatus.CONFIRMED))
                .thenReturn(List.of(staleConfirmed));
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result =
                api.assign(
                        actorId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        List.of(kidA));

        assertThat(result.status()).isEqualTo(CoverageStatus.CONFIRMED);
        verify(assignments).save(any());
    }

    @Test
    void assignPendingAllowedWhenAdultConfirmedOnOverlappingItem() {
        UUID otherItemId = UUID.randomUUID();
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        stubManualItem(List.of(kidA));
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndCoveringAdultIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(otherAdultId),
                        any()))
                .thenReturn(Optional.empty());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of());
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result =
                api.assign(
                        actorId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        otherAdultId,
                        List.of(kidA));

        assertThat(result.status()).isEqualTo(CoverageStatus.PENDING);
        verify(assignments, never())
                .findByCircleIdAndCoveringAdultIdAndStatus(any(), any(), any());
    }

    @Test
    void declinePendingByAssignee() {
        UUID assignmentId = UUID.randomUUID();
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        assignmentId,
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        otherAdultId,
                        actorId,
                        CoverageStatus.PENDING,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(otherAdultId)).thenReturn(circleId);
        when(assignments.findById(assignmentId)).thenReturn(Optional.of(row));
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result = api.decline(otherAdultId, assignmentId);

        assertThat(result.status()).isEqualTo(CoverageStatus.DECLINED);
    }

    @Test
    void reassignChangesAdultBackToPending() {
        UUID assignmentId = UUID.randomUUID();
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        assignmentId,
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        when(assignments.findById(assignmentId)).thenReturn(Optional.of(row));
        stubManualItem(List.of(kidA, kidB));
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of(row));
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CoverageAssignmentDto result =
                api.reassign(actorId, assignmentId, otherAdultId, List.of(kidA, kidB));

        assertThat(result.status()).isEqualTo(CoverageStatus.PENDING);
        assertThat(result.coveringAdultId()).isEqualTo(otherAdultId);
        assertThat(result.kidIds()).containsExactlyInAnyOrder(kidA, kidB);
        ArgumentCaptor<CoverageAssignmentEntity> saved =
                ArgumentCaptor.forClass(CoverageAssignmentEntity.class);
        verify(assignments).save(saved.capture());
        assertThat(saved.getValue().coveringAdultId()).isEqualTo(otherAdultId);
    }

    @Test
    void removeDeletesAssignment() {
        UUID assignmentId = UUID.randomUUID();
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        assignmentId,
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(membershipApi.requireMemberCircleId(actorId)).thenReturn(circleId);
        when(assignments.findById(assignmentId)).thenReturn(Optional.of(row));

        api.remove(actorId, assignmentId);

        verify(assignments).delete(row);
    }

    @Test
    void releaseKidDropsKidAndKeepsOtherKidsOnRow() {
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidA, kidB),
                        Instant.now(),
                        Instant.now());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of(row));
        when(assignments.save(any())).thenAnswer(inv -> inv.getArgument(0));

        api.releaseKidFromActiveRows(circleId, CoverageItemSource.MANUAL, itemId, kidA);

        ArgumentCaptor<CoverageAssignmentEntity> saved =
                ArgumentCaptor.forClass(CoverageAssignmentEntity.class);
        verify(assignments).save(saved.capture());
        assertThat(saved.getValue().kidIds()).containsExactly(kidB);
        verify(assignments, never()).delete(any());
    }

    @Test
    void releaseKidDeletesRowWhenLastKidRemoved() {
        CoverageAssignmentEntity row =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.FEED,
                        itemId,
                        otherAdultId,
                        actorId,
                        CoverageStatus.PENDING,
                        Set.of(kidA),
                        Instant.now(),
                        Instant.now());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.FEED), eq(itemId), any()))
                .thenReturn(List.of(row));

        api.releaseKidFromActiveRows(circleId, CoverageItemSource.FEED, itemId, kidA);

        verify(assignments).delete(row);
        verify(assignments, never()).save(any());
    }

    @Test
    void releaseKidNoOpWhenKidNotOnActiveRow() {
        CoverageAssignmentEntity otherKid =
                new CoverageAssignmentEntity(
                        UUID.randomUUID(),
                        circleId,
                        CoverageItemSource.MANUAL,
                        itemId,
                        actorId,
                        actorId,
                        CoverageStatus.CONFIRMED,
                        Set.of(kidB),
                        Instant.now(),
                        Instant.now());
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of(otherKid));

        api.releaseKidFromActiveRows(circleId, CoverageItemSource.MANUAL, itemId, kidA);

        verify(assignments, never()).save(any());
        verify(assignments, never()).delete(any());
    }

    @Test
    void releaseKidIgnoresDeclinedRows() {
        when(assignments.findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId), eq(CoverageItemSource.MANUAL), eq(itemId), any()))
                .thenReturn(List.of());

        api.releaseKidFromActiveRows(circleId, CoverageItemSource.MANUAL, itemId, kidA);

        verify(assignments)
                .findByCircleIdAndItemSourceAndItemIdAndStatusIn(
                        eq(circleId),
                        eq(CoverageItemSource.MANUAL),
                        eq(itemId),
                        eq(Set.of(CoverageStatus.PENDING, CoverageStatus.CONFIRMED)));
        verify(assignments, never()).save(any());
        verify(assignments, never()).delete(any());
    }

    private void stubManualItem(List<UUID> kidIds) {
        when(manualEventCalendarApi.findInCircle(circleId, itemId))
                .thenReturn(
                        Optional.of(
                                new ManualCalendarEventDto(
                                        itemId,
                                        "Practice",
                                        Instant.parse("2026-08-15T17:00:00Z"),
                                        Instant.parse("2026-08-15T18:00:00Z"),
                                        "Rink",
                                        kidIds)));
    }
}
