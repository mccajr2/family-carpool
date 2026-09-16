-- Persisted FORCE_MERGE / FORCE_SPLIT for one adult + leg + ordered item pair.
-- Driving blocks themselves stay computed; overrides are the only stored state.
CREATE TABLE calendar_drive_block_overrides (
    id                 UUID PRIMARY KEY,
    adult_id           UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    leg                VARCHAR(8) NOT NULL,
    left_item_source   VARCHAR(16) NOT NULL,
    left_item_id       UUID NOT NULL,
    right_item_source  VARCHAR(16) NOT NULL,
    right_item_id      UUID NOT NULL,
    action             VARCHAR(16) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT calendar_drive_block_overrides_adult_pair_unique
        UNIQUE (adult_id, leg, left_item_source, left_item_id, right_item_source, right_item_id),
    CONSTRAINT calendar_drive_block_overrides_leg_check
        CHECK (leg IN ('TO', 'FROM')),
    CONSTRAINT calendar_drive_block_overrides_left_source_check
        CHECK (left_item_source IN ('MANUAL', 'FEED')),
    CONSTRAINT calendar_drive_block_overrides_right_source_check
        CHECK (right_item_source IN ('MANUAL', 'FEED')),
    CONSTRAINT calendar_drive_block_overrides_action_check
        CHECK (action IN ('FORCE_MERGE', 'FORCE_SPLIT')),
    CONSTRAINT calendar_drive_block_overrides_distinct_pair_check
        CHECK (NOT (left_item_source = right_item_source AND left_item_id = right_item_id))
);

CREATE INDEX calendar_drive_block_overrides_adult_id_idx
    ON calendar_drive_block_overrides (adult_id);
