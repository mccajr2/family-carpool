package com.yourorg.quickapp.rsvp.internal;

import com.yourorg.quickapp.rsvp.RsvpItemSource;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface RsvpRepository extends JpaRepository<RsvpEntity, UUID> {

    List<RsvpEntity> findByCircleIdAndItemSourceAndItemIdIn(
            UUID circleId, RsvpItemSource itemSource, Collection<UUID> itemIds);

    List<RsvpEntity> findByCircleIdAndItemSourceAndItemId(
            UUID circleId, RsvpItemSource itemSource, UUID itemId);

    Optional<RsvpEntity> findByCircleIdAndItemSourceAndItemIdAndKidId(
            UUID circleId, RsvpItemSource itemSource, UUID itemId, UUID kidId);
}
