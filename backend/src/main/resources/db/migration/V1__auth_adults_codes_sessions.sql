-- Adults and auth tables for email OTP + Bearer sessions.
CREATE TABLE adults (
    id              UUID PRIMARY KEY,
    email           VARCHAR(320) NOT NULL,
    display_name    VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT adults_email_unique UNIQUE (email)
);

CREATE TABLE auth_codes (
    id              UUID PRIMARY KEY,
    email           VARCHAR(320) NOT NULL,
    code_hash       VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auth_codes_email_created_idx ON auth_codes (email, created_at DESC);

CREATE TABLE auth_sessions (
    id              UUID PRIMARY KEY,
    adult_id        UUID NOT NULL REFERENCES adults (id),
    token_hash      VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_sessions_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX auth_sessions_adult_id_idx ON auth_sessions (adult_id);
