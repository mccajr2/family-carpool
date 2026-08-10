-- Named places for a family circle (label + free-text address; lat/lng later).
CREATE TABLE family_places (
    id               UUID PRIMARY KEY,
    circle_id        UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    name             VARCHAR(80) NOT NULL,
    name_normalized  VARCHAR(80) NOT NULL,
    address          VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT family_places_circle_name_unique UNIQUE (circle_id, name_normalized)
);

CREATE INDEX family_places_circle_id_idx ON family_places (circle_id);
