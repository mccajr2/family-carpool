package org.example.project

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Swift-friendly bridge for email OTP auth on iOS. */
class AuthBridge {
    private val session: AuthSession
    private val scope: CoroutineScope

    constructor() {
        session =
            AuthSession(
                client = AuthClient.create(),
                tokenStore = IosSecureTokenStore(),
            )
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    }

    constructor(session: AuthSession, scope: CoroutineScope) {
        this.session = session
        this.scope = scope
    }

    fun requestCode(
        email: String,
        onSuccess: (String?) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val result = session.requestCode(email)
                onSuccess(result.devCode)
            } catch (e: Throwable) {
                onError(e.message ?: "Request failed")
            }
        }
    }

    fun verifyCode(
        email: String,
        code: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val adult = session.verifyCode(email, code)
                onSuccess(adult.email)
            } catch (e: Throwable) {
                onError(e.message ?: "Verify failed")
            }
        }
    }

    fun currentEmail(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                onSuccess(session.currentAdult().email)
            } catch (e: Throwable) {
                onError(e.message ?: "Not signed in")
            }
        }
    }

    fun logout(
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                session.logout()
                onSuccess()
            } catch (e: Throwable) {
                onError(e.message ?: "Logout failed")
            }
        }
    }

    fun isSignedIn(): Boolean = session.isSignedIn()
}
