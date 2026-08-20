package com.yourorg.quickapp.carpool.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.UUID;

@Embeddable
class RideKidSnapshot {

    @Column(name = "kid_id", nullable = false)
    private UUID kidId;

    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    protected RideKidSnapshot() {}

    RideKidSnapshot(UUID kidId, String firstName) {
        this.kidId = kidId;
        this.firstName = firstName;
    }

    UUID kidId() {
        return kidId;
    }

    String firstName() {
        return firstName;
    }
}
