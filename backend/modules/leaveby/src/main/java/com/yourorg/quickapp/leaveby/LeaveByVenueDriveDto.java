package com.yourorg.quickapp.leaveby;

/**
 * Cache-only destination identity + one-way home→venue duration for driving-block
 * merge. Never triggers Nominatim/OSRM HTTP.
 *
 * @param venueIdentity rounded lat,lng key when dest is in {@code geocode_cache};
 *     null when missing
 * @param oneWayDriveSeconds cached route duration when available; null when
 *     origin/dest/duration is unsettled (PENDING / UNAVAILABLE)
 */
public record LeaveByVenueDriveDto(String venueIdentity, Integer oneWayDriveSeconds) {

    public static LeaveByVenueDriveDto unavailable() {
        return new LeaveByVenueDriveDto(null, null);
    }
}
