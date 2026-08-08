package com.yourorg.quickapp.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RequestAuthCodeRequest(
        @NotBlank @Email String email) {}
