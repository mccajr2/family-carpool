-- Space-scoped standing ride arrangement (series Ask / fixed primary).
-- Parallel to household standing_block_templates — do not reuse that table.
CREATE TABLE standing_ride_arrangements (
    id                      UUID PRIMARY KEY,
    space_id                UUID NOT NULL REFERENCES carpool_spaces (id) ON DELETE CASCADE,
    requesting_circle_id    UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    requested_by_adult_id   UUID NOT NULL REFERENCES adults (id),
    feed_id                 UUID NOT NULL,
    day_of_week             VARCHAR(16) NOT NULL,
    minute_of_day           INT NOT NULL,
    normalized_location     VARCHAR(500) NOT NULL DEFAULT '',
    fingerprint_encoded     TEXT NOT NULL,
    time_zone               VARCHAR(64) NOT NULL,
    assignment              VARCHAR(32) NOT NULL,
    status                  VARCHAR(16) NOT NULL,
    primary_adult_id        UUID REFERENCES adults (id),
    primary_circle_id       UUID REFERENCES family_circles (id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                TIMESTAMPTZ,
    CONSTRAINT standing_ride_arrangements_dow_check
        CHECK (day_of_week IN (
            'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
            'FRIDAY', 'SATURDAY', 'SUNDAY'
        )),
    CONSTRAINT standing_ride_arrangements_minute_check
        CHECK (minute_of_day >= 0 AND minute_of_day <= 1439),
    CONSTRAINT standing_ride_arrangements_assignment_check
        CHECK (assignment IN ('FIXED_PRIMARY')),
    CONSTRAINT standing_ride_arrangements_status_check
        CHECK (status IN ('OPEN', 'ACTIVE', 'ENDED')),
    CONSTRAINT standing_ride_arrangements_primary_check
        CHECK (
            (status = 'ACTIVE'
                AND primary_adult_id IS NOT NULL
                AND primary_circle_id IS NOT NULL)
            OR (status <> 'ACTIVE'
                AND primary_adult_id IS NULL
                AND primary_circle_id IS NULL)
        )
);

-- At most one non-ENDED arrangement per (space, requesting circle, fingerprint).
CREATE UNIQUE INDEX standing_ride_arrangements_open_active_unique
    ON standing_ride_arrangements (space_id, requesting_circle_id, fingerprint_encoded)
    WHERE status IN ('OPEN', 'ACTIVE');

CREATE INDEX standing_ride_arrangements_space_id_idx
    ON standing_ride_arrangements (space_id);

CREATE INDEX standing_ride_arrangements_fingerprint_lookup_idx
    ON standing_ride_arrangements (feed_id, day_of_week, minute_of_day);

CREATE TABLE standing_ride_arrangement_kids (
    arrangement_id  UUID NOT NULL
        REFERENCES standing_ride_arrangements (id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL,
    kid_id          UUID NOT NULL,
    first_name      VARCHAR(80) NOT NULL,
    PRIMARY KEY (arrangement_id, sort_order)
);

CREATE TABLE standing_ride_arrangement_legs (
    arrangement_id      UUID NOT NULL
        REFERENCES standing_ride_arrangements (id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL,
    kind                VARCHAR(8) NOT NULL,
    phase               VARCHAR(32) NOT NULL,
    meet_side           VARCHAR(16) NOT NULL DEFAULT 'REQUESTER',
    place_id            UUID REFERENCES family_places (id) ON DELETE SET NULL,
    one_time_address    VARCHAR(255),
    place_name          VARCHAR(80),
    place_address       VARCHAR(255),
    PRIMARY KEY (arrangement_id, sort_order),
    CONSTRAINT standing_ride_arrangement_legs_kind_check
        CHECK (kind IN ('TO', 'FROM')),
    CONSTRAINT standing_ride_arrangement_legs_phase_check
        CHECK (phase IN ('NEEDS_RIDE', 'ASKED_TEAM')),
    CONSTRAINT standing_ride_arrangement_legs_sort_check
        CHECK (sort_order IN (0, 1)),
    CONSTRAINT standing_ride_arrangement_legs_kind_unique
        UNIQUE (arrangement_id, kind),
    CONSTRAINT standing_ride_arrangement_legs_meet_side_check
        CHECK (meet_side IN ('REQUESTER', 'ACCEPTOR')),
    CONSTRAINT standing_ride_arrangement_legs_place_mode_check
        CHECK (place_id IS NULL OR one_time_address IS NULL)
);

CREATE INDEX standing_ride_arrangement_kids_arrangement_idx
    ON standing_ride_arrangement_kids (arrangement_id);

CREATE INDEX standing_ride_arrangement_legs_arrangement_idx
    ON standing_ride_arrangement_legs (arrangement_id);
