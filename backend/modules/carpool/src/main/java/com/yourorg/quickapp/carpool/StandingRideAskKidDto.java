package com.yourorg.quickapp.carpool;

import java.util.UUID;

/** Kid snapshot on a standing Ask template (name frozen at create). */
public record StandingRideAskKidDto(UUID kidId, String firstName) {}
