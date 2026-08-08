package org.example.project

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Swift-friendly bridge for email OTP auth + family circle on iOS. */
class AuthBridge {
    private val session: AuthSession
    private val familyClient: FamilyClient
    private val scope: CoroutineScope

    constructor() {
        session =
            AuthSession(
                client = AuthClient.create(),
                tokenStore = IosSecureTokenStore(),
            )
        familyClient = FamilyClient.create()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    }

    constructor(session: AuthSession, familyClient: FamilyClient, scope: CoroutineScope) {
        this.session = session
        this.familyClient = familyClient
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

    fun loadFamily(
        onNeedsCreate: (email: String) -> Unit,
        onReady: (
            title: String,
            email: String,
            displayName: String?,
            role: String,
            kidIds: List<String>,
            kidNames: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val adult = session.currentAdult()
                val circle = familyClient.getCircle(session.requireAccessToken())
                if (circle == null) {
                    onNeedsCreate(adult.email)
                } else {
                    onReady(
                        circle.displayTitle(),
                        adult.email,
                        adult.displayName,
                        circle.role.name,
                        circle.kids.map { it.id },
                        circle.kids.map { it.displayName },
                    )
                }
            } catch (e: Throwable) {
                onError(e.message ?: "Failed to load family")
            }
        }
    }

    fun createFamilyCircle(
        adultDisplayName: String,
        circleName: String?,
        onSuccess: (title: String, email: String, displayName: String?, role: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val token = session.requireAccessToken()
                val name = circleName?.trim()?.ifEmpty { null }
                val circle =
                    familyClient.createCircle(
                        accessToken = token,
                        adultDisplayName = adultDisplayName.trim(),
                        name = name,
                    )
                val adult = session.currentAdult()
                onSuccess(circle.displayTitle(), adult.email, adult.displayName, circle.role.name)
            } catch (e: Throwable) {
                onError(e.message ?: "Create failed")
            }
        }
    }

    fun addKid(
        displayName: String,
        onSuccess: (id: String, name: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val kid = familyClient.addKid(session.requireAccessToken(), displayName.trim())
                onSuccess(kid.id, kid.displayName)
            } catch (e: Throwable) {
                onError(e.message ?: "Add kid failed")
            }
        }
    }

    fun renameKid(
        kidId: String,
        displayName: String,
        onSuccess: (id: String, name: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val kid =
                    familyClient.updateKid(
                        session.requireAccessToken(),
                        kidId,
                        displayName.trim(),
                    )
                onSuccess(kid.id, kid.displayName)
            } catch (e: Throwable) {
                onError(e.message ?: "Rename failed")
            }
        }
    }

    fun removeKid(
        kidId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.deleteKid(session.requireAccessToken(), kidId)
                onSuccess()
            } catch (e: Throwable) {
                onError(e.message ?: "Remove failed")
            }
        }
    }
}
