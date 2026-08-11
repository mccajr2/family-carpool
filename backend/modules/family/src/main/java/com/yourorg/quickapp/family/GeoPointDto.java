package com.yourorg.quickapp.family;

/** WGS84 point from geocoding (public; do not expose family.internal types). */
public record GeoPointDto(double latitude, double longitude) {}
