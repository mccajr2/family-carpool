package org.example.project

/**
 * Coordinates OTP auth API calls with secure token persistence.
 */
class AuthSession(
    private val client: AuthClient = AuthClient.create(),
    private val tokenStore: SecureTokenStore,
) {
    fun isSignedIn(): Boolean = tokenStore.loadAccessToken() != null

    suspend fun requestCode(email: String): RequestAuthCodeResponse = client.requestCode(email)

    suspend fun verifyCode(
        email: String,
        code: String,
    ): Adult {
        val session = client.verifyCode(email, code)
        tokenStore.saveAccessToken(session.accessToken)
        return session.adult
    }

    suspend fun currentAdult(): Adult {
        val token =
            tokenStore.loadAccessToken()
                ?: throw AuthApiException("Not signed in")
        return client.getMe(token)
    }

    fun requireAccessToken(): String =
        tokenStore.loadAccessToken() ?: throw AuthApiException("Not signed in")

    suspend fun logout() {
        val token = tokenStore.loadAccessToken()
        if (token != null) {
            try {
                client.logout(token)
            } finally {
                tokenStore.clear()
            }
        } else {
            tokenStore.clear()
        }
    }

    /**
     * Drops the stored token without calling the server. Use when the session is already known to
     * be unusable — a server round-trip would only fail again, and it must never throw.
     */
    fun clearLocalSession() {
        tokenStore.clear()
    }
}
