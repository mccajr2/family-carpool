-- Circle-local household ride plans (no team space yet). ASK_TEAM still requires
-- a space. Null space_id rows are keyed by requesting_circle_id + event_key.
ALTER TABLE carpool_ride_requests
    ALTER COLUMN space_id DROP NOT NULL;

DROP INDEX IF EXISTS carpool_ride_requests_active_unique;

CREATE UNIQUE INDEX carpool_ride_requests_active_space_unique
    ON carpool_ride_requests (space_id, event_key, requesting_circle_id)
    WHERE status IN ('PENDING', 'ACCEPTED', 'PLAN') AND space_id IS NOT NULL;

CREATE UNIQUE INDEX carpool_ride_requests_active_circle_unique
    ON carpool_ride_requests (requesting_circle_id, event_key)
    WHERE status IN ('PENDING', 'ACCEPTED', 'PLAN') AND space_id IS NULL;
