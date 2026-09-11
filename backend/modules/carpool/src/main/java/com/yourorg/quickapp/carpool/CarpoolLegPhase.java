package com.yourorg.quickapp.carpool;

/**
 * Per-leg transport phase. Accept = confirm (no claimed-unconfirmed state).
 */
public enum CarpoolLegPhase {
    NEEDS_RIDE,
    WAITING_HOUSEHOLD,
    ASKED_TEAM,
    CONFIRMED
}
