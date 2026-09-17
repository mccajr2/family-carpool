-- Per-leg itinerary home-side override (Leaving from / Returning to).
-- Modes: Default (both null) / named located place / one-time free-text.
-- Independent of calendar-item / coverage leave-from.
ALTER TABLE leaveby_itineraries
    ADD COLUMN home_place_id UUID
        REFERENCES family_places (id) ON DELETE SET NULL,
    ADD COLUMN home_address VARCHAR(255),
    ADD CONSTRAINT leaveby_itineraries_home_xor_check
        CHECK (home_place_id IS NULL OR home_address IS NULL);

CREATE INDEX leaveby_itineraries_home_place_id_idx
    ON leaveby_itineraries (home_place_id);
