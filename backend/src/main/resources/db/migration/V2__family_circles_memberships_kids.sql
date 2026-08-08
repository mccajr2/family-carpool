-- Family circle, membership, and kids (one circle per adult in v1).
CREATE TABLE family_circles (
    id              UUID PRIMARY KEY,
    name            VARCHAR(80),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE family_memberships (
    id              UUID PRIMARY KEY,
    circle_id       UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    adult_id        UUID NOT NULL REFERENCES adults (id),
    role            VARCHAR(32) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT family_memberships_adult_unique UNIQUE (adult_id),
    CONSTRAINT family_memberships_circle_adult_unique UNIQUE (circle_id, adult_id)
);

CREATE INDEX family_memberships_circle_id_idx ON family_memberships (circle_id);

CREATE TABLE family_kids (
    id              UUID PRIMARY KEY,
    circle_id       UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    display_name    VARCHAR(80) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX family_kids_circle_id_idx ON family_kids (circle_id);
