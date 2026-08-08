package org.example.project

/** Platform secure storage for the Bearer access token (not plain prefs). */
interface SecureTokenStore {
    fun saveAccessToken(token: String)

    fun loadAccessToken(): String?

    fun clear()
}

/** In-memory store for tests and ephemeral sessions. */
class InMemorySecureTokenStore : SecureTokenStore {
    private var token: String? = null

    override fun saveAccessToken(token: String) {
        this.token = token
    }

    override fun loadAccessToken(): String? = token

    override fun clear() {
        token = null
    }
}
