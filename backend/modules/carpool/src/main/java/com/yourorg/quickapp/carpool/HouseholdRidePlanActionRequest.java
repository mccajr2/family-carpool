package com.yourorg.quickapp.carpool;

import jakarta.validation.constraints.NotBlank;

/** Confirm or decline WAITING_HOUSEHOLD legs assigned to the caller. */
public record HouseholdRidePlanActionRequest(@NotBlank String eventKey) {}
