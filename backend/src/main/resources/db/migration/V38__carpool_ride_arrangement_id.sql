-- Link materialised (and future) ride rows to a standing ride arrangement.
ALTER TABLE carpool_ride_requests
    ADD COLUMN arrangement_id UUID
        REFERENCES standing_ride_arrangements (id) ON DELETE SET NULL;

CREATE INDEX carpool_ride_requests_arrangement_id_idx
    ON carpool_ride_requests (arrangement_id)
    WHERE arrangement_id IS NOT NULL;
