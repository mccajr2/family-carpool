-- Per-leg TO/FROM slots on team ride requests (carpool-leg-to-from).
CREATE TABLE carpool_ride_request_legs (
    ride_id             UUID NOT NULL REFERENCES carpool_ride_requests (id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL,
    kind                VARCHAR(8) NOT NULL,
    phase               VARCHAR(32) NOT NULL,
    assignee_adult_id   UUID REFERENCES adults (id),
    assignee_circle_id  UUID REFERENCES family_circles (id),
    PRIMARY KEY (ride_id, sort_order),
    CONSTRAINT carpool_ride_request_legs_kind_check
        CHECK (kind IN ('TO', 'FROM')),
    CONSTRAINT carpool_ride_request_legs_phase_check
        CHECK (phase IN ('NEEDS_RIDE', 'WAITING_HOUSEHOLD', 'ASKED_TEAM', 'CONFIRMED')),
    CONSTRAINT carpool_ride_request_legs_sort_check
        CHECK (sort_order IN (0, 1)),
    CONSTRAINT carpool_ride_request_legs_kind_unique UNIQUE (ride_id, kind)
);

CREATE INDEX carpool_ride_request_legs_ride_idx
    ON carpool_ride_request_legs (ride_id);

-- v1 both-legs: PENDING → ASKED_TEAM; ACCEPTED → CONFIRMED with accepter; else NEEDS_RIDE.
INSERT INTO carpool_ride_request_legs (
    ride_id, sort_order, kind, phase, assignee_adult_id, assignee_circle_id
)
SELECT
    r.id,
    0,
    'TO',
    CASE r.status
        WHEN 'PENDING' THEN 'ASKED_TEAM'
        WHEN 'ACCEPTED' THEN 'CONFIRMED'
        ELSE 'NEEDS_RIDE'
    END,
    CASE WHEN r.status = 'ACCEPTED' THEN r.accepted_by_adult_id ELSE NULL END,
    CASE WHEN r.status = 'ACCEPTED' THEN r.accepting_circle_id ELSE NULL END
FROM carpool_ride_requests r;

INSERT INTO carpool_ride_request_legs (
    ride_id, sort_order, kind, phase, assignee_adult_id, assignee_circle_id
)
SELECT
    r.id,
    1,
    'FROM',
    CASE r.status
        WHEN 'PENDING' THEN 'ASKED_TEAM'
        WHEN 'ACCEPTED' THEN 'CONFIRMED'
        ELSE 'NEEDS_RIDE'
    END,
    CASE WHEN r.status = 'ACCEPTED' THEN r.accepted_by_adult_id ELSE NULL END,
    CASE WHEN r.status = 'ACCEPTED' THEN r.accepting_circle_id ELSE NULL END
FROM carpool_ride_requests r;
