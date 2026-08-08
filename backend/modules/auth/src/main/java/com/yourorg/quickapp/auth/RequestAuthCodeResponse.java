package com.yourorg.quickapp.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RequestAuthCodeResponse(String email, int expiresInSeconds, String devCode) {
    public static RequestAuthCodeResponse withoutDevCode(String email, int expiresInSeconds) {
        return new RequestAuthCodeResponse(email, expiresInSeconds, null);
    }
}
