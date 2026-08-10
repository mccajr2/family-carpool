package com.yourorg.quickapp.family;

import java.util.UUID;

public record PlaceResponse(
        UUID id, String name, String address, Double latitude, Double longitude) {}
