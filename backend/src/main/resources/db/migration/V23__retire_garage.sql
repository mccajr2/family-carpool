-- Hard-delete garage capacity (vehicles, drives, vPIC cache) and ride vehicle binding.
-- Revive only via an explicit parked garage-capacity (etc.) slice.

DROP INDEX IF EXISTS carpool_ride_requests_vehicle_event_unique;

ALTER TABLE carpool_ride_requests
    DROP COLUMN IF EXISTS vehicle_id;

DROP TABLE IF EXISTS family_vehicle_drivers;
DROP TABLE IF EXISTS family_vehicles;
DROP TABLE IF EXISTS vpic_seat_cache;

ALTER TABLE family_memberships
    DROP COLUMN IF EXISTS drives;
