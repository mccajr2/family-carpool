package com.yourorg.quickapp.family.internal;

import java.util.Optional;

/** Port for resolving an address to coordinates (Nominatim or test stub). */
interface GeocoderPort {
    Optional<GeoCoordinates> geocode(String address);
}
