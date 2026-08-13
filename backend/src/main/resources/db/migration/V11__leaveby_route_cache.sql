-- Successful OSRM driving durations, keyed like the OSRM request coordinates.
CREATE TABLE leaveby_route_cache (
    route_key         VARCHAR(80) PRIMARY KEY,
    duration_seconds  DOUBLE PRECISION NOT NULL,
    fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
