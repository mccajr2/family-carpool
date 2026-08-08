package com.yourorg.quickapp.auth;

import com.yourorg.quickapp.auth.internal.AuthService;
import com.yourorg.quickapp.auth.internal.BearerTokenResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final BearerTokenResolver bearerTokenResolver;

    public AuthController(AuthService authService, BearerTokenResolver bearerTokenResolver) {
        this.authService = authService;
        this.bearerTokenResolver = bearerTokenResolver;
    }

    @PostMapping("/request-code")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public RequestAuthCodeResponse requestCode(
            @Valid @RequestBody RequestAuthCodeRequest request, HttpServletRequest httpRequest) {
        return authService.requestCode(request.email(), clientKey(httpRequest));
    }

    @PostMapping("/verify-code")
    public AuthSessionResponse verifyCode(
            @Valid @RequestBody VerifyAuthCodeRequest request, HttpServletRequest httpRequest) {
        return authService.verifyCode(request.email(), request.code(), clientKey(httpRequest));
    }

    @GetMapping("/me")
    public AdultResponse me(HttpServletRequest httpRequest) {
        return authService.currentAdult(requireBearer(httpRequest));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest httpRequest) {
        authService.logout(requireBearer(httpRequest));
    }

    private String requireBearer(HttpServletRequest httpRequest) {
        return bearerTokenResolver
                .resolve(httpRequest)
                .orElseThrow(() -> AuthService.unauthorized("Missing or invalid Bearer token"));
    }

    private static String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
