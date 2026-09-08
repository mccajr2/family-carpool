-- Per-adult designated Spotify playlist for each circle kid.
CREATE TABLE spotify_kid_designations (
    adult_id              UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    kid_id                UUID NOT NULL REFERENCES family_kids (id) ON DELETE CASCADE,
    spotify_playlist_id   VARCHAR(128) NOT NULL,
    playlist_name         VARCHAR(200) NOT NULL,
    playlist_url          VARCHAR(512) NOT NULL,
    track_count           INTEGER,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (adult_id, kid_id)
);

CREATE INDEX spotify_kid_designations_kid_idx ON spotify_kid_designations (kid_id);
CREATE INDEX spotify_kid_designations_adult_idx ON spotify_kid_designations (adult_id);
