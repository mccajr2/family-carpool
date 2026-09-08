-- Per-assignment leave-from override: named place XOR one-time address.
-- Both null = Default (membership default → first located place).
ALTER TABLE coverage_assignments
    ADD COLUMN leave_from_place_id UUID
        REFERENCES family_places (id) ON DELETE SET NULL,
    ADD COLUMN leave_from_address VARCHAR(255),
    ADD CONSTRAINT coverage_assignments_leave_from_xor_check
        CHECK (leave_from_place_id IS NULL OR leave_from_address IS NULL);

CREATE INDEX coverage_assignments_leave_from_place_id_idx
    ON coverage_assignments (leave_from_place_id);
