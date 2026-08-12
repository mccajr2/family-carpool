-- Per-adult default leave-from place (located circle place).
ALTER TABLE family_memberships
    ADD COLUMN default_leave_from_place_id UUID
        REFERENCES family_places (id) ON DELETE SET NULL;

CREATE INDEX family_memberships_default_leave_from_place_id_idx
    ON family_memberships (default_leave_from_place_id);
