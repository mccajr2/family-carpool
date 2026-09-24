package com.yourorg.quickapp.carpool;

import java.util.List;
import java.util.UUID;

/**
 * Save-shaped household plan group for standing Lock snapshot (placeId XOR
 * one-time address — never display-only address beside a named place).
 */
public record CarpoolStandingPlanGroupDto(List<UUID> kidIds, List<CarpoolStandingPlanLegDto> legs) {}
