package com.yourorg.quickapp.rsvp;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Public RSVP surface for calendar enrichment and per-kid attendance writes.
 * Missing rows are {@link RsvpStatus#NO_RESPONSE}.
 */
public interface RsvpApi {

    /** Stored YES/NO rows for many items of one source. Does not materialize NO_RESPONSE. */
    List<RsvpDto> listForItems(
            UUID circleId, RsvpItemSource source, Collection<UUID> itemIds);

    /**
     * One status per requested kid on a single item. Kids with no row are
     * {@link RsvpStatus#NO_RESPONSE}.
     */
    List<RsvpDto> statusesForKids(
            UUID circleId, RsvpItemSource source, UUID itemId, Collection<UUID> kidIds);

    /**
     * {@link RsvpStatus#YES} / {@link RsvpStatus#NO} upsert. {@link
     * RsvpStatus#NO_RESPONSE} deletes the row (no-op if missing).
     */
    RsvpDto setStatus(
            UUID circleId,
            RsvpItemSource source,
            UUID itemId,
            UUID kidId,
            RsvpStatus status,
            UUID updatedByAdultId);

    /**
     * Delete RSVP rows for kids no longer on the item. {@code remainingKidIds}
     * is the item's current kid list; empty deletes every row for that item.
     */
    void deleteForKidsNotOnItem(
            UUID circleId,
            RsvpItemSource source,
            UUID itemId,
            Collection<UUID> remainingKidIds);
}
