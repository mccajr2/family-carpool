-- Manual (non-feed) circle events + kid links.
CREATE TABLE manual_events (
    id         UUID PRIMARY KEY,
    circle_id  UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    title      VARCHAR(500) NOT NULL,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ,
    location   VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX manual_events_circle_starts_at_idx ON manual_events (circle_id, starts_at, id);

CREATE TABLE manual_event_kids (
    event_id UUID NOT NULL REFERENCES manual_events (id) ON DELETE CASCADE,
    kid_id   UUID NOT NULL REFERENCES family_kids (id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, kid_id)
);

CREATE INDEX manual_event_kids_kid_id_idx ON manual_event_kids (kid_id);
