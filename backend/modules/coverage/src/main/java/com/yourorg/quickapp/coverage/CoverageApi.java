package com.yourorg.quickapp.coverage;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Public coverage surface for calendar enrichment and assign/confirm/decline
 * writes. Responsibility only — not trip / seat planning.
 */
public interface CoverageApi {

    /** All assignments for one calendar item (any status), ordered by createdAt. */
    List<CoverageAssignmentDto> listForItem(
            UUID circleId, CoverageItemSource source, UUID itemId);

    /**
     * Assignments for many items of one source (any status). Used when enriching
     * an Agenda page.
     */
    List<CoverageAssignmentDto> listForItems(
            UUID circleId, CoverageItemSource source, Collection<UUID> itemIds);

    /**
     * Load an assignment in the actor's circle.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 404
     */
    CoverageAssignmentDto requireAssignment(UUID actorAdultId, UUID assignmentId);

    /**
     * Create coverage for an adult + kid subset on an item. Self-assign →
     * CONFIRMED; otherwise PENDING. If the covering adult already has an active
     * (PENDING/CONFIRMED) row on this item, updates that row instead.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 400 / 404 / 409
     */
    CoverageAssignmentDto assign(
            UUID actorAdultId,
            CoverageItemSource source,
            UUID itemId,
            UUID coveringAdultId,
            List<UUID> kidIds);

    /**
     * Change covering adult and/or kids on an existing assignment.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 400 / 403 / 404 / 409
     */
    CoverageAssignmentDto reassign(
            UUID actorAdultId, UUID assignmentId, UUID coveringAdultId, List<UUID> kidIds);

    /**
     * Remove an assignment entirely (any member of the circle).
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 404
     */
    void remove(UUID actorAdultId, UUID assignmentId);

    /**
     * Assignee confirms a PENDING assignment → CONFIRMED.
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 403 / 404 / 409
     */
    CoverageAssignmentDto confirm(UUID actorAdultId, UUID assignmentId);

    /**
     * Assignee declines → DECLINED (kids no longer held).
     *
     * @throws com.yourorg.quickapp.family.FamilyAccessException 403 / 404 / 409
     */
    CoverageAssignmentDto decline(UUID actorAdultId, UUID assignmentId);
}
