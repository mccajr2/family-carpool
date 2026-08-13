package com.yourorg.quickapp.calendar;

import com.yourorg.quickapp.rsvp.RsvpStatus;
import jakarta.validation.constraints.NotNull;

public record SetCalendarRsvpRequest(@NotNull RsvpStatus status) {}
