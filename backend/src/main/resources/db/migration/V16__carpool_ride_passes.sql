-- Per-adult pass on a PENDING ride request (does not cancel for others).
CREATE TABLE carpool_ride_passes (
    id          UUID PRIMARY KEY,
    ride_id     UUID NOT NULL REFERENCES carpool_ride_requests (id) ON DELETE CASCADE,
    adult_id    UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_ride_passes_ride_adult_unique UNIQUE (ride_id, adult_id)
);

CREATE INDEX carpool_ride_passes_adult_idx ON carpool_ride_passes (adult_id);
