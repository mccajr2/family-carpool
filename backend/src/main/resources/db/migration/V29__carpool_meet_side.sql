-- Meet side per TO/FROM leg (carpool-meet-at): whose place is the meet point.
-- REQUESTER = requesting circle's family-side place (default for existing rows).
-- ACCEPTOR = accepting driver's place (bound on Accept; empty while PENDING).
ALTER TABLE carpool_ride_request_legs
    ADD COLUMN meet_side VARCHAR(16) NOT NULL DEFAULT 'REQUESTER';

ALTER TABLE carpool_ride_request_legs
    ADD CONSTRAINT carpool_ride_request_legs_meet_side_check
        CHECK (meet_side IN ('REQUESTER', 'ACCEPTOR'));
