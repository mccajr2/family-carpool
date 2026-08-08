package com.yourorg.quickapp.auth;

import java.util.UUID;

public record AdultResponse(UUID id, String email, String displayName) {}
