package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.rsvp.RsvpStatus;
import java.util.UUID;

/** Per-kid RSVP on a calendar Agenda row. */
public record CalendarRsvpResponse(UUID kidId, RsvpStatus status) {}
