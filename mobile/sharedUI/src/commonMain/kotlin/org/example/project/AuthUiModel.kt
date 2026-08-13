package org.example.project

/**
 * Testable email-OTP auth flow used by the Compose [AuthScreen].
 */
class AuthUiModel(
    private val session: AuthSession,
) {
    sealed class State {
        data class SignedOut(
            val email: String = "",
            val code: String = "",
            val codeSent: Boolean = false,
            val devHint: String? = null,
            val loading: Boolean = false,
            val error: String? = null,
        ) : State()

        data class SignedIn(
            val email: String,
            val loading: Boolean = false,
            val error: String? = null,
        ) : State()
    }

    private var _state: State =
        if (session.isSignedIn()) {
            State.SignedIn(email = "")
        } else {
            State.SignedOut()
        }

    val state: State
        get() = _state

    suspend fun restoreIfSignedIn() {
        if (!session.isSignedIn()) {
            _state = State.SignedOut()
            return
        }
        _state = State.SignedIn(email = "", loading = true)
        try {
            val adult = session.currentAdult()
            _state = State.SignedIn(email = adult.email)
        } catch (e: Throwable) {
            if (e is AuthApiException && e.unreachable) {
                // An unreachable backend is not an expired session: keep the stored token so the
                // user stays signed in and a retry works once it is back.
                _state = State.SignedIn(email = "", error = e.message)
            } else {
                session.clearLocalSession()
                _state = State.SignedOut(error = e.message ?: "Session expired")
            }
        }
    }

    fun updateEmail(email: String) {
        val current = _state as? State.SignedOut ?: return
        _state = current.copy(email = email, error = null)
    }

    fun updateCode(code: String) {
        val current = _state as? State.SignedOut ?: return
        _state = current.copy(code = code, error = null)
    }

    suspend fun sendCode() {
        val current = _state as? State.SignedOut ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val result = session.requestCode(current.email.trim())
            _state =
                current.copy(
                    loading = false,
                    codeSent = true,
                    code = result.devCode ?: current.code,
                    devHint = result.devCode,
                    error = null,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Request failed",
                )
        }
    }

    suspend fun verifyCode() {
        val current = _state as? State.SignedOut ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val adult = session.verifyCode(current.email.trim(), current.code.trim())
            _state = State.SignedIn(email = adult.email)
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Verify failed",
                )
        }
    }

    suspend fun signOut() {
        val current = _state as? State.SignedIn ?: return
        _state = current.copy(loading = true, error = null)
        // The stored token is dropped even when the server call fails, so the local session is
        // gone either way — staying on SignedIn would leave a signed-in screen with no token.
        _state =
            try {
                session.logout()
                State.SignedOut()
            } catch (e: Throwable) {
                State.SignedOut(error = e.message ?: "Sign out failed")
            }
    }
}
