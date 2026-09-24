-- Circle-scoped standing drive-block plan (Lock). Blocks stay computed;
-- this template is the persisted household pattern for forward apply.
CREATE TABLE standing_block_templates (
    id                   UUID PRIMARY KEY,
    circle_id            UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    fingerprint_set_key  TEXT NOT NULL,
    created_by_adult_id  UUID NOT NULL REFERENCES adults (id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT standing_block_templates_circle_set_unique
        UNIQUE (circle_id, fingerprint_set_key)
);

CREATE INDEX standing_block_templates_circle_id_idx
    ON standing_block_templates (circle_id);

CREATE TABLE standing_block_template_members (
    id                     UUID PRIMARY KEY,
    template_id            UUID NOT NULL
        REFERENCES standing_block_templates (id) ON DELETE CASCADE,
    position               INT NOT NULL,
    feed_id                UUID NOT NULL,
    day_of_week            VARCHAR(16) NOT NULL,
    minute_of_day          INT NOT NULL,
    normalized_location    VARCHAR(500) NOT NULL DEFAULT '',
    fingerprint_encoded    TEXT NOT NULL,
    coverages_json         TEXT NOT NULL,
    ride_plans_json        TEXT NOT NULL,
    route_origins_json     TEXT NOT NULL,
    CONSTRAINT standing_block_template_members_position_unique
        UNIQUE (template_id, position),
    CONSTRAINT standing_block_template_members_fp_unique
        UNIQUE (template_id, fingerprint_encoded),
    CONSTRAINT standing_block_template_members_dow_check
        CHECK (day_of_week IN (
            'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
            'FRIDAY', 'SATURDAY', 'SUNDAY'
        )),
    CONSTRAINT standing_block_template_members_minute_check
        CHECK (minute_of_day >= 0 AND minute_of_day <= 1439),
    CONSTRAINT standing_block_template_members_position_check
        CHECK (position >= 0)
);

CREATE INDEX standing_block_template_members_template_id_idx
    ON standing_block_template_members (template_id);

CREATE INDEX standing_block_template_members_feed_lookup_idx
    ON standing_block_template_members (feed_id, day_of_week, minute_of_day);
