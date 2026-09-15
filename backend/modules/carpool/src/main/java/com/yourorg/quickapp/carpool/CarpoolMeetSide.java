package com.yourorg.quickapp.carpool;

/**
 * Whose family-side place is the meet point on an Ask-the-team leg.
 *
 * <p>{@link #REQUESTER} — meet at the requesting circle's place (default).
 * {@link #ACCEPTOR} — meet at the accepting driver's place (bound on Accept).
 */
public enum CarpoolMeetSide {
    REQUESTER,
    ACCEPTOR
}
