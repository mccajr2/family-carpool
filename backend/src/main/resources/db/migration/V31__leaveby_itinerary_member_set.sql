-- Persist calendar routes by driving-block member-set + leg (not path itemId alone).
ALTER TABLE leaveby_itineraries
    ADD COLUMN leg VARCHAR(8) NOT NULL DEFAULT 'TO',
    ADD COLUMN member_set_key VARCHAR(64) NOT NULL DEFAULT '',
    ADD COLUMN members_token TEXT NOT NULL DEFAULT '';

-- Singleton backfill. member_set_key uses row id so existing rows stay unique;
-- the next getOrRefresh rebuilds under the Java member-set hash and replaces.
UPDATE leaveby_itineraries
SET members_token = item_source || '/' || item_id::text,
    member_set_key = replace(id::text, '-', '');

ALTER TABLE leaveby_itineraries
    DROP CONSTRAINT leaveby_itineraries_adult_item_unique;

ALTER TABLE leaveby_itineraries
    ADD CONSTRAINT leaveby_itineraries_adult_leg_members_unique
        UNIQUE (driving_adult_id, leg, member_set_key),
    ADD CONSTRAINT leaveby_itineraries_leg_check
        CHECK (leg IN ('TO', 'FROM'));

CREATE INDEX leaveby_itineraries_adult_idx
    ON leaveby_itineraries (driving_adult_id);
