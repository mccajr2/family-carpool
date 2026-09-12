-- Circle-local ride plans (household-only / mixed save) use PLAN so they are
-- not listed as team asks. One active plan or ask per circle+event.
ALTER TABLE carpool_ride_requests
    DROP CONSTRAINT carpool_ride_requests_status_check;

ALTER TABLE carpool_ride_requests
    ADD CONSTRAINT carpool_ride_requests_status_check
        CHECK (status IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'PLAN'));

DROP INDEX IF EXISTS carpool_ride_requests_active_unique;

CREATE UNIQUE INDEX carpool_ride_requests_active_unique
    ON carpool_ride_requests (space_id, event_key, requesting_circle_id)
    WHERE status IN ('PENDING', 'ACCEPTED', 'PLAN');
