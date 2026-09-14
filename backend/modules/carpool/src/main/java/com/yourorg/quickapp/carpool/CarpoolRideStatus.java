package com.yourorg.quickapp.carpool;

public enum CarpoolRideStatus {
    PENDING,
    ACCEPTED,
    CANCELLED,
    /**
     * Circle-local or household-only plan (no open team ask). Returned on
     * {@code ownRequests}; singular {@code ownRequest} stays null for PLAN.
     */
    PLAN
}
