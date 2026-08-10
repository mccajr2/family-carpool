-- Coordinates on places + shared address geocode cache (Nominatim).
ALTER TABLE family_places
    ADD COLUMN latitude  DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION;

CREATE TABLE geocode_cache (
    address_normalized VARCHAR(255) PRIMARY KEY,
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    fetched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
