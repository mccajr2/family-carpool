-- Per-adult drives flag + circle vehicles (owner + drivers, optional kept-at place).
ALTER TABLE family_memberships
    ADD COLUMN drives BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE family_vehicles (
    id                    UUID PRIMARY KEY,
    circle_id             UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    owner_adult_id        UUID NOT NULL REFERENCES adults (id),
    kept_at_place_id      UUID REFERENCES family_places (id) ON DELETE SET NULL,
    label                 VARCHAR(80) NOT NULL,
    label_normalized      VARCHAR(80) NOT NULL,
    year                  INTEGER NOT NULL,
    make                  VARCHAR(140) NOT NULL,
    model                 VARCHAR(140) NOT NULL,
    seats                 INTEGER NOT NULL,
    suggested_seats       INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT family_vehicles_seats_range CHECK (seats >= 2 AND seats <= 18),
    CONSTRAINT family_vehicles_year_min CHECK (year >= 1996),
    CONSTRAINT family_vehicles_owner_label_unique UNIQUE (circle_id, owner_adult_id, label_normalized)
);

CREATE INDEX family_vehicles_circle_id_idx ON family_vehicles (circle_id);
CREATE INDEX family_vehicles_owner_idx ON family_vehicles (circle_id, owner_adult_id);

CREATE TABLE family_vehicle_drivers (
    vehicle_id UUID NOT NULL REFERENCES family_vehicles (id) ON DELETE CASCADE,
    adult_id   UUID NOT NULL REFERENCES adults (id),
    PRIMARY KEY (vehicle_id, adult_id)
);

CREATE INDEX family_vehicle_drivers_adult_idx ON family_vehicle_drivers (adult_id);

CREATE TABLE vpic_seat_cache (
    make_normalized  VARCHAR(140) NOT NULL,
    model_normalized VARCHAR(140) NOT NULL,
    year             INTEGER NOT NULL,
    seats            INTEGER NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (make_normalized, model_normalized, year)
);
