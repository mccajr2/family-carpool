package com.yourorg.quickapp.rsvp;

/**
 * Per-kid attendance on a calendar item. {@link #NO_RESPONSE} is never stored —
 * it is the absence of a row.
 */
public enum RsvpStatus {
    YES,
    NO,
    NO_RESPONSE
}
