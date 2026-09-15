-- Family-side place per TO/FROM leg (carpool-leg-places).
-- Modes: Default (both place_id + one_time_address null), named place, or one-time.
-- place_name / place_address are write-time snapshots for teammate-visible display.
ALTER TABLE carpool_ride_request_legs
    ADD COLUMN place_id UUID REFERENCES family_places (id) ON DELETE SET NULL,
    ADD COLUMN one_time_address VARCHAR(255),
    ADD COLUMN place_name VARCHAR(80),
    ADD COLUMN place_address VARCHAR(255);

ALTER TABLE carpool_ride_request_legs
    ADD CONSTRAINT carpool_ride_request_legs_place_mode_check
        CHECK (place_id IS NULL OR one_time_address IS NULL);
