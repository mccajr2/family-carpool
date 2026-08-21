-- Ride requests: space + event + requesting circle. Snapshots kid names and pickup.
CREATE TABLE carpool_ride_requests (
    id                      UUID PRIMARY KEY,
    space_id                UUID NOT NULL REFERENCES carpool_spaces (id) ON DELETE CASCADE,
    event_key               VARCHAR(1280) NOT NULL,
    requesting_circle_id    UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    requested_by_adult_id   UUID NOT NULL REFERENCES adults (id),
    pickup_place_name       VARCHAR(80) NOT NULL,
    pickup_address          VARCHAR(255) NOT NULL,
    status                  VARCHAR(16) NOT NULL,
    accepted_by_adult_id    UUID REFERENCES adults (id),
    accepting_circle_id     UUID REFERENCES family_circles (id),
    vehicle_id              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_ride_requests_status_check
        CHECK (status IN ('PENDING', 'ACCEPTED', 'CANCELLED'))
);

CREATE UNIQUE INDEX carpool_ride_requests_active_unique
    ON carpool_ride_requests (space_id, event_key, requesting_circle_id)
    WHERE status IN ('PENDING', 'ACCEPTED');

CREATE UNIQUE INDEX carpool_ride_requests_vehicle_event_unique
    ON carpool_ride_requests (space_id, event_key, vehicle_id)
    WHERE status = 'ACCEPTED' AND vehicle_id IS NOT NULL;

CREATE INDEX carpool_ride_requests_space_event_idx
    ON carpool_ride_requests (space_id, event_key, status);

CREATE TABLE carpool_ride_request_kids (
    ride_id     UUID NOT NULL REFERENCES carpool_ride_requests (id) ON DELETE CASCADE,
    sort_order  INTEGER NOT NULL,
    kid_id      UUID NOT NULL,
    first_name  VARCHAR(80) NOT NULL,
    PRIMARY KEY (ride_id, sort_order)
);
