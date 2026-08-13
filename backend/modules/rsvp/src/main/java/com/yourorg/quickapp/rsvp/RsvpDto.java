package com.yourorg.quickapp.rsvp;

import java.util.UUID;

/** Per-kid RSVP visible to calendar / clients. */
public record RsvpDto(RsvpItemSource itemSource, UUID itemId, UUID kidId, RsvpStatus status) {}
