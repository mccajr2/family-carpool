package com.yourorg.quickapp.auth;

public record AuthSessionResponse(String accessToken, String tokenType, AdultResponse adult) {
    public static AuthSessionResponse bearer(String accessToken, AdultResponse adult) {
        return new AuthSessionResponse(accessToken, "Bearer", adult);
    }
}
