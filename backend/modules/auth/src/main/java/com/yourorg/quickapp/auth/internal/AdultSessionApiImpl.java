package com.yourorg.quickapp.auth.internal;

import com.yourorg.quickapp.auth.AdultResponse;
import com.yourorg.quickapp.auth.AdultSessionApi;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class AdultSessionApiImpl implements AdultSessionApi {

    private final AuthService authService;
    private final BearerTokenResolver bearerTokenResolver;

    AdultSessionApiImpl(AuthService authService, BearerTokenResolver bearerTokenResolver) {
        this.authService = authService;
        this.bearerTokenResolver = bearerTokenResolver;
    }

    @Override
    public AdultResponse requireCurrentAdult(HttpServletRequest request) {
        String token =
                bearerTokenResolver
                        .resolve(request)
                        .orElseThrow(() -> AuthService.unauthorized("Missing or invalid Bearer token"));
        return authService.currentAdult(token);
    }

    @Override
    public AdultResponse requireAdult(UUID adultId) {
        return authService.requireAdult(adultId);
    }

    @Override
    public AdultResponse updateDisplayName(UUID adultId, String displayName) {
        return authService.updateDisplayName(adultId, displayName);
    }
}
