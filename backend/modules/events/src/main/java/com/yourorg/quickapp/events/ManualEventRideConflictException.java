package com.yourorg.quickapp.events;

/** Space-scoped active rides block changing or clearing a manual event's team link. */
public class ManualEventRideConflictException extends RuntimeException {

    public ManualEventRideConflictException(String message) {
        super(message);
    }
}
