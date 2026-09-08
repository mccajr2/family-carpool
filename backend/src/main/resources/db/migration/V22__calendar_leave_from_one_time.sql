-- Item leave-from override: named place XOR one-time address (no row = Default).
ALTER TABLE calendar_leave_from
    ALTER COLUMN place_id DROP NOT NULL,
    ADD COLUMN leave_from_address VARCHAR(255),
    ADD CONSTRAINT calendar_leave_from_xor_check
        CHECK (
            (place_id IS NOT NULL AND leave_from_address IS NULL)
            OR (place_id IS NULL AND leave_from_address IS NOT NULL)
        );
