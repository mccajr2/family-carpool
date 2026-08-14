-- Team carpool spaces: one space per normalized feed URL; membership is the family circle.
CREATE TABLE carpool_spaces (
    id                     UUID PRIMARY KEY,
    name                   VARCHAR(80) NOT NULL,
    normalized_source_url  VARCHAR(2048) NOT NULL,
    invite_code            VARCHAR(16) NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_spaces_url_unique UNIQUE (normalized_source_url),
    CONSTRAINT carpool_spaces_invite_code_unique UNIQUE (invite_code)
);

CREATE TABLE carpool_space_memberships (
    id           UUID PRIMARY KEY,
    space_id     UUID NOT NULL REFERENCES carpool_spaces (id) ON DELETE CASCADE,
    circle_id    UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    membership   VARCHAR(16) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_space_memberships_role_check CHECK (membership IN ('OWNER', 'MEMBER')),
    CONSTRAINT carpool_space_memberships_space_circle_unique UNIQUE (space_id, circle_id)
);

CREATE INDEX carpool_space_memberships_circle_id_idx
    ON carpool_space_memberships (circle_id);

CREATE TABLE carpool_join_requests (
    id                     UUID PRIMARY KEY,
    space_id               UUID NOT NULL REFERENCES carpool_spaces (id) ON DELETE CASCADE,
    circle_id              UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    requested_by_adult_id  UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT carpool_join_requests_space_circle_unique UNIQUE (space_id, circle_id)
);

CREATE INDEX carpool_join_requests_circle_id_idx
    ON carpool_join_requests (circle_id);
