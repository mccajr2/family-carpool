package com.yourorg.quickapp.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

/**
 * Public auth surface for other Modulith modules (e.g. family) to resolve the
 * current Bearer adult and update profile fields without touching auth internals.
 */
public interface AdultSessionApi {

    AdultResponse requireCurrentAdult(HttpServletRequest request);

    AdultResponse updateDisplayName(UUID adultId, String displayName);
}
