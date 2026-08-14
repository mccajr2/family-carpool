package com.yourorg.quickapp.family;

import java.util.UUID;

/**
 * Circle identity for other modules (e.g. carpool member / join-request labels).
 * {@code name} is null when unnamed; clients show "Your family".
 */
public record FamilyCircleName(UUID id, String name) {}
