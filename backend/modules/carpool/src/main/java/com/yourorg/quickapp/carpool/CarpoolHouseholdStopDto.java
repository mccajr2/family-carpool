package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

/**
 * Family-side stop on a CONFIRMED household / own-plan leg the adult is
 * driving — used as a Route middle (TO pickup / FROM drop-off).
 */
public record CarpoolHouseholdStopDto(
        UUID feedEventId,
        CarpoolLegKind leg,
        String placeName,
        String placeAddress,
        List<UUID> kidIds) {}
