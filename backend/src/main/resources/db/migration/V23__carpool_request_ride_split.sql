-- Split v1 household CarpoolRideRequest into per-kid CarpoolRequest needs +
-- per-leg Ride fulfillments. Keeps v1 tables in place until the HTTP layer
-- cuts over (later task); dogfood PENDING/ACCEPTED rows are copied forward.

CREATE TABLE carpool_requests (
    id                      UUID PRIMARY KEY,
    space_id                UUID NOT NULL REFERENCES carpool_spaces (id) ON DELETE CASCADE,
    event_key               VARCHAR(1280) NOT NULL,
    kid_id                  UUID NOT NULL,
    kid_first_name          VARCHAR(80) NOT NULL,
    requesting_circle_id    UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    created_by_adult_id     UUID NOT NULL REFERENCES adults (id),
    pickup_place_name       VARCHAR(80) NOT NULL,
    pickup_address          VARCHAR(255) NOT NULL,
    meet_point_to           VARCHAR(255),
    meet_point_from         VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_requests_space_event_kid_circle_unique
        UNIQUE (space_id, event_key, kid_id, requesting_circle_id)
);

CREATE INDEX carpool_requests_space_event_idx
    ON carpool_requests (space_id, event_key);

CREATE TABLE carpool_request_legs_needed (
    request_id  UUID NOT NULL REFERENCES carpool_requests (id) ON DELETE CASCADE,
    leg         VARCHAR(8) NOT NULL,
    CONSTRAINT carpool_request_legs_needed_leg_check CHECK (leg IN ('TO', 'FROM')),
    PRIMARY KEY (request_id, leg)
);

CREATE TABLE carpool_rides (
    id                  UUID PRIMARY KEY,
    space_id            UUID NOT NULL REFERENCES carpool_spaces (id) ON DELETE CASCADE,
    event_key           VARCHAR(1280) NOT NULL,
    leg                 VARCHAR(8) NOT NULL,
    driver_adult_id     UUID NOT NULL REFERENCES adults (id),
    driving_circle_id   UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    vehicle_id          UUID NOT NULL,
    status              VARCHAR(16) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_rides_leg_check CHECK (leg IN ('TO', 'FROM')),
    CONSTRAINT carpool_rides_status_check
        CHECK (status IN ('ACTIVE', 'CANCELLED', 'WITHDRAWN'))
);

CREATE UNIQUE INDEX carpool_rides_vehicle_event_leg_active_unique
    ON carpool_rides (space_id, event_key, vehicle_id, leg)
    WHERE status = 'ACTIVE';

CREATE INDEX carpool_rides_space_event_status_idx
    ON carpool_rides (space_id, event_key, status);

CREATE TABLE carpool_ride_passengers (
    ride_id     UUID NOT NULL REFERENCES carpool_rides (id) ON DELETE CASCADE,
    request_id  UUID NOT NULL REFERENCES carpool_requests (id) ON DELETE CASCADE,
    PRIMARY KEY (ride_id, request_id)
);

CREATE INDEX carpool_ride_passengers_request_idx
    ON carpool_ride_passengers (request_id);

-- Pass soft-declines attach to a need (request), not a fulfillment ride.
CREATE TABLE carpool_request_passes (
    id          UUID PRIMARY KEY,
    request_id  UUID NOT NULL REFERENCES carpool_requests (id) ON DELETE CASCADE,
    adult_id    UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_request_passes_request_adult_unique UNIQUE (request_id, adult_id)
);

CREATE INDEX carpool_request_passes_adult_idx ON carpool_request_passes (adult_id);

-- Staging maps for deterministic copy of v1 rows.
CREATE TABLE carpool_v1_request_map (
    old_ride_id     UUID NOT NULL,
    kid_id          UUID NOT NULL,
    new_request_id  UUID NOT NULL PRIMARY KEY,
    CONSTRAINT carpool_v1_request_map_old_kid_unique UNIQUE (old_ride_id, kid_id)
);

CREATE TABLE carpool_v1_ride_map (
    old_ride_id  UUID NOT NULL,
    leg          VARCHAR(8) NOT NULL,
    new_ride_id  UUID NOT NULL PRIMARY KEY,
    CONSTRAINT carpool_v1_ride_map_old_leg_unique UNIQUE (old_ride_id, leg),
    CONSTRAINT carpool_v1_ride_map_leg_check CHECK (leg IN ('TO', 'FROM'))
);

INSERT INTO carpool_v1_request_map (old_ride_id, kid_id, new_request_id)
SELECT r.id, k.kid_id, gen_random_uuid()
FROM carpool_ride_requests r
JOIN carpool_ride_request_kids k ON k.ride_id = r.id
WHERE r.status IN ('PENDING', 'ACCEPTED');

INSERT INTO carpool_requests (
    id,
    space_id,
    event_key,
    kid_id,
    kid_first_name,
    requesting_circle_id,
    created_by_adult_id,
    pickup_place_name,
    pickup_address,
    meet_point_to,
    meet_point_from,
    created_at
)
SELECT
    m.new_request_id,
    r.space_id,
    r.event_key,
    k.kid_id,
    k.first_name,
    r.requesting_circle_id,
    r.requested_by_adult_id,
    r.pickup_place_name,
    r.pickup_address,
    NULL,
    NULL,
    r.created_at
FROM carpool_v1_request_map m
JOIN carpool_ride_requests r ON r.id = m.old_ride_id
JOIN carpool_ride_request_kids k
    ON k.ride_id = r.id AND k.kid_id = m.kid_id;

INSERT INTO carpool_request_legs_needed (request_id, leg)
SELECT m.new_request_id, legs.leg
FROM carpool_v1_request_map m
CROSS JOIN (VALUES ('TO'), ('FROM')) AS legs(leg);

INSERT INTO carpool_v1_ride_map (old_ride_id, leg, new_ride_id)
SELECT r.id, legs.leg, gen_random_uuid()
FROM carpool_ride_requests r
CROSS JOIN (VALUES ('TO'), ('FROM')) AS legs(leg)
WHERE r.status = 'ACCEPTED'
  AND r.accepted_by_adult_id IS NOT NULL
  AND r.accepting_circle_id IS NOT NULL
  AND r.vehicle_id IS NOT NULL;

INSERT INTO carpool_rides (
    id,
    space_id,
    event_key,
    leg,
    driver_adult_id,
    driving_circle_id,
    vehicle_id,
    status,
    created_at
)
SELECT
    m.new_ride_id,
    r.space_id,
    r.event_key,
    m.leg,
    r.accepted_by_adult_id,
    r.accepting_circle_id,
    r.vehicle_id,
    'ACTIVE',
    r.created_at
FROM carpool_v1_ride_map m
JOIN carpool_ride_requests r ON r.id = m.old_ride_id;

INSERT INTO carpool_ride_passengers (ride_id, request_id)
SELECT rm.new_ride_id, qm.new_request_id
FROM carpool_v1_ride_map rm
JOIN carpool_v1_request_map qm ON qm.old_ride_id = rm.old_ride_id;

INSERT INTO carpool_request_passes (id, request_id, adult_id, created_at)
SELECT gen_random_uuid(), m.new_request_id, p.adult_id, p.created_at
FROM carpool_ride_passes p
JOIN carpool_v1_request_map m ON m.old_ride_id = p.ride_id;

DROP TABLE carpool_v1_ride_map;
DROP TABLE carpool_v1_request_map;
