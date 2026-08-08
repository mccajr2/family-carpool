package com.yourorg.quickapp.auth.internal;

/** Port for delivering sign-in codes. Production SMTP is a later slice. */
public interface AuthMailPort {
    void sendSignInCode(String email, String code);
}
