package com.yourorg.quickapp.carpool;

import java.util.List;

/** Kids + TO/FROM ask shape for a standing ride arrangement. */
public record StandingRideAskTemplateDto(
        List<StandingRideAskKidDto> kids, List<StandingRideAskLegDto> legs) {}
