-- Allow multiple active RideRequests per circle+event when kids diverge.
-- Kid exclusivity (a kid on at most one non-cancelled plan) is enforced in
-- CarpoolRideService, not by a unique index (kids live in a child table).
DROP INDEX IF EXISTS carpool_ride_requests_active_space_unique;
DROP INDEX IF EXISTS carpool_ride_requests_active_circle_unique;
