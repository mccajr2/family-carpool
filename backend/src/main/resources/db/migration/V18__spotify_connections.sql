-- Per-adult Spotify OAuth connection (encrypted tokens) + short-lived CSRF state.
CREATE TABLE spotify_connections (
    adult_id                   UUID PRIMARY KEY REFERENCES adults (id) ON DELETE CASCADE,
    spotify_user_id            VARCHAR(128) NOT NULL,
    access_token_ciphertext    TEXT NOT NULL,
    refresh_token_ciphertext   TEXT NOT NULL,
    access_token_expires_at    TIMESTAMPTZ NOT NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE spotify_oauth_states (
    state       VARCHAR(64) PRIMARY KEY,
    adult_id    UUID NOT NULL REFERENCES adults (id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX spotify_oauth_states_expires_idx ON spotify_oauth_states (expires_at);
