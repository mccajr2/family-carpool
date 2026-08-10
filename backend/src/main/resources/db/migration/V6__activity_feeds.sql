-- Activity feeds (iCal subscribe) + imported events.
CREATE TABLE activity_feeds (
    id               UUID PRIMARY KEY,
    circle_id        UUID NOT NULL REFERENCES family_circles (id) ON DELETE CASCADE,
    name             VARCHAR(80) NOT NULL,
    source_url       VARCHAR(2048) NOT NULL,
    last_synced_at   TIMESTAMPTZ,
    last_sync_error  VARCHAR(500),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT activity_feeds_circle_url_unique UNIQUE (circle_id, source_url)
);

CREATE INDEX activity_feeds_circle_id_idx ON activity_feeds (circle_id);

CREATE TABLE activity_feed_kids (
    feed_id UUID NOT NULL REFERENCES activity_feeds (id) ON DELETE CASCADE,
    kid_id  UUID NOT NULL REFERENCES family_kids (id) ON DELETE CASCADE,
    PRIMARY KEY (feed_id, kid_id)
);

CREATE INDEX activity_feed_kids_kid_id_idx ON activity_feed_kids (kid_id);

CREATE TABLE activity_feed_events (
    id         UUID PRIMARY KEY,
    feed_id    UUID NOT NULL REFERENCES activity_feeds (id) ON DELETE CASCADE,
    uid        VARCHAR(255),
    summary    VARCHAR(500) NOT NULL,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ,
    location   VARCHAR(500),
    CONSTRAINT activity_feed_events_feed_uid_unique UNIQUE (feed_id, uid)
);

CREATE INDEX activity_feed_events_feed_id_idx ON activity_feed_events (feed_id);
