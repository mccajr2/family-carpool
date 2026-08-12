-- Coverage responsibility assignments for calendar items (MANUAL or FEED).
CREATE TABLE coverage_assignments (
    id                    UUID PRIMARY KEY,
    circle_id             UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    item_source           VARCHAR(16) NOT NULL,
    item_id               UUID NOT NULL,
    covering_adult_id     UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    assigned_by_adult_id  UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    status                VARCHAR(16) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coverage_assignments_source_check CHECK (item_source IN ('MANUAL', 'FEED')),
    CONSTRAINT coverage_assignments_status_check
        CHECK (status IN ('PENDING', 'CONFIRMED', 'DECLINED'))
);

CREATE INDEX coverage_assignments_circle_item_idx
    ON coverage_assignments (circle_id, item_source, item_id);

CREATE INDEX coverage_assignments_covering_adult_id_idx
    ON coverage_assignments (covering_adult_id);

CREATE TABLE coverage_assignment_kids (
    assignment_id UUID NOT NULL REFERENCES coverage_assignments (id) ON DELETE CASCADE,
    kid_id        UUID NOT NULL REFERENCES family_kids (id) ON DELETE CASCADE,
    PRIMARY KEY (assignment_id, kid_id)
);

CREATE INDEX coverage_assignment_kids_kid_id_idx ON coverage_assignment_kids (kid_id);
