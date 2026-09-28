-- Per-adult soft Pass on an OPEN standing arrangement (does not end for others).
CREATE TABLE standing_ride_arrangement_passes (
    id              UUID PRIMARY KEY,
    arrangement_id  UUID NOT NULL
        REFERENCES standing_ride_arrangements (id) ON DELETE CASCADE,
    adult_id        UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT standing_ride_arrangement_passes_unique
        UNIQUE (arrangement_id, adult_id)
);

CREATE INDEX standing_ride_arrangement_passes_adult_idx
    ON standing_ride_arrangement_passes (adult_id);

CREATE INDEX standing_ride_arrangement_passes_arrangement_idx
    ON standing_ride_arrangement_passes (arrangement_id);
