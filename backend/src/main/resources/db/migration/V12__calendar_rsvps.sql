-- Per-kid RSVP on a calendar item (MANUAL or FEED). NO_RESPONSE is absence of a row.
CREATE TABLE calendar_rsvps (
    id                    UUID PRIMARY KEY,
    circle_id             UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    item_source           VARCHAR(16) NOT NULL,
    item_id               UUID NOT NULL,
    kid_id                UUID NOT NULL REFERENCES family_kids (id) ON DELETE CASCADE,
    status                VARCHAR(16) NOT NULL,
    updated_by_adult_id   UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT calendar_rsvps_source_check CHECK (item_source IN ('MANUAL', 'FEED')),
    CONSTRAINT calendar_rsvps_status_check CHECK (status IN ('YES', 'NO')),
    CONSTRAINT calendar_rsvps_item_kid_unique UNIQUE (circle_id, item_source, item_id, kid_id)
);

CREATE INDEX calendar_rsvps_circle_item_idx
    ON calendar_rsvps (circle_id, item_source, item_id);
