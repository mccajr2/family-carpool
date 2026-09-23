-- Zone used for fingerprint weekday / time-of-day and apply day grouping.
ALTER TABLE standing_block_templates
    ADD COLUMN time_zone VARCHAR(64) NOT NULL DEFAULT 'UTC';

ALTER TABLE standing_block_templates
    ALTER COLUMN time_zone DROP DEFAULT;
