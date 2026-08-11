-- Per-adult leave-from place override for a calendar item (MANUAL or FEED).
CREATE TABLE calendar_leave_from (
    id            UUID PRIMARY KEY,
    adult_id      UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    item_source   VARCHAR(16) NOT NULL,
    item_id       UUID NOT NULL,
    place_id      UUID NOT NULL REFERENCES family_places (id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT calendar_leave_from_adult_item_unique UNIQUE (adult_id, item_source, item_id),
    CONSTRAINT calendar_leave_from_source_check CHECK (item_source IN ('MANUAL', 'FEED'))
);

CREATE INDEX calendar_leave_from_adult_id_idx ON calendar_leave_from (adult_id);
CREATE INDEX calendar_leave_from_place_id_idx ON calendar_leave_from (place_id);
