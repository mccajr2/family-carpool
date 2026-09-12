package com.yourorg.quickapp.carpool;

public enum CarpoolRideStatus {
    PENDING,
    ACCEPTED,
    CANCELLED,
    /**
     * Circle-local plan (household legs only). Never returned as
     * {@code ownRequest} / {@code otherRequests}; backs {@code ownLegs} only.
     */
    PLAN
}
