-- Cached multi-stop driving itinerary for a confirmed ride (estimate only).
CREATE TABLE leaveby_itineraries (
    id                 UUID PRIMARY KEY,
    driving_adult_id   UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    item_source        VARCHAR(16) NOT NULL,
    item_id            UUID NOT NULL,
    status             VARCHAR(16) NOT NULL,
    reason             VARCHAR(64),
    buffer_minutes     INT NOT NULL,
    stop_fingerprint   VARCHAR(64) NOT NULL,
    stops_json         TEXT NOT NULL,
    leg_minutes_json   TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT leaveby_itineraries_adult_item_unique
        UNIQUE (driving_adult_id, item_source, item_id),
    CONSTRAINT leaveby_itineraries_source_check
        CHECK (item_source IN ('MANUAL', 'FEED')),
    CONSTRAINT leaveby_itineraries_status_check
        CHECK (status IN ('OK', 'UNAVAILABLE')),
    CONSTRAINT leaveby_itineraries_buffer_check
        CHECK (buffer_minutes >= 0)
);

CREATE INDEX leaveby_itineraries_item_idx
    ON leaveby_itineraries (item_source, item_id);
