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
        onNeedsCreate: (email: String, hasDisplayName: Boolean) -> Unit,
        onReady: (
            title: String,
            email: String,
            adultId: String,
            displayName: String?,
            role: String,
            inviteCode: String?,
            memberAdultIds: List<String>,
            memberEmails: List<String>,
            memberNames: List<String>,
            memberRoles: List<String>,
            kidIds: List<String>,
            kidNames: List<String>,
            placeIds: List<String>,
            placeNames: List<String>,
            placeAddresses: List<String>,
            placeLocated: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val adult = session.currentAdult()
                val token = session.requireAccessToken()
                val circle = familyClient.getCircle(token)
                if (circle == null) {
                    onNeedsCreate(adult.email, !adult.displayName.isNullOrBlank())
                } else {
                    emitReady(adult, circle, token, onReady)
                }
            } catch (e: Throwable) {
                onError(e.message ?: "Failed to load family")
            }
        }
    }

    fun createFamilyCircle(
        adultDisplayName: String,
        circleName: String?,
        onSuccess: (
            title: String,
            email: String,
            adultId: String,
            displayName: String?,
            role: String,
            inviteCode: String?,
            memberAdultIds: List<String>,
            memberEmails: List<String>,
            memberNames: List<String>,
            memberRoles: List<String>,
            kidIds: List<String>,
            kidNames: List<String>,
            placeIds: List<String>,
            placeNames: List<String>,
            placeAddresses: List<String>,
            placeLocated: List<String>,
        ) -> Unit,
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
                emitReady(adult, circle, token, onSuccess)
            } catch (e: Throwable) {
                onError(e.message ?: "Create failed")
            }
        }
    }

    fun joinFamilyCircle(
        code: String,
        adultDisplayName: String?,
        onSuccess: (
            title: String,
            email: String,
            adultId: String,
            displayName: String?,
            role: String,
            inviteCode: String?,
            memberAdultIds: List<String>,
            memberEmails: List<String>,
            memberNames: List<String>,
            memberRoles: List<String>,
            kidIds: List<String>,
            kidNames: List<String>,
            placeIds: List<String>,
            placeNames: List<String>,
            placeAddresses: List<String>,
            placeLocated: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val token = session.requireAccessToken()
                val circle =
                    familyClient.joinCircle(
                        accessToken = token,
                        code = code.trim(),
                        adultDisplayName = adultDisplayName?.trim()?.ifEmpty { null },
                    )
                val adult = session.currentAdult()
                emitReady(adult, circle, token, onSuccess)
            } catch (e: Throwable) {
                onError(e.message ?: "Join failed")
            }
        }
    }

    fun regenerateInvite(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val invite = familyClient.regenerateInvite(session.requireAccessToken())
                onSuccess(invite.code)
            } catch (e: Throwable) {
                onError(e.message ?: "Regenerate failed")
            }
        }
    }

    fun leaveFamily(
        onSuccess: (email: String, hasDisplayName: Boolean) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.leaveCircle(session.requireAccessToken())
                val adult = session.currentAdult()
                onSuccess(adult.email, !adult.displayName.isNullOrBlank())
            } catch (e: Throwable) {
                onError(e.message ?: "Leave failed")
            }
        }
    }

    fun updateMemberRole(
        adultId: String,
        role: String,
        onSuccess: (
            title: String,
            email: String,
            adultId: String,
            displayName: String?,
            role: String,
            inviteCode: String?,
            memberAdultIds: List<String>,
            memberEmails: List<String>,
            memberNames: List<String>,
            memberRoles: List<String>,
            kidIds: List<String>,
            kidNames: List<String>,
            placeIds: List<String>,
            placeNames: List<String>,
            placeAddresses: List<String>,
            placeLocated: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val familyRole = FamilyRole.valueOf(role)
                val token = session.requireAccessToken()
                val circle = familyClient.updateMemberRole(token, adultId, familyRole)
                val adult = session.currentAdult()
                emitReady(adult, circle, token, onSuccess)
            } catch (e: Throwable) {
                onError(e.message ?: "Update role failed")
            }
        }
    }

    fun removeMember(
        adultId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.removeMember(session.requireAccessToken(), adultId)
                onSuccess()
            } catch (e: Throwable) {
                onError(e.message ?: "Remove member failed")
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


    fun addPlace(
        name: String,
        address: String,
        onSuccess: (id: String, name: String, address: String, located: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val place =
                    familyClient.addPlace(
                        session.requireAccessToken(),
                        name.trim(),
                        address.trim(),
                    )
                onSuccess(place.id, place.name, place.address, if (place.isLocated()) "true" else "false")
            } catch (e: Throwable) {
                onError(e.message ?: "Add place failed")
            }
        }
    }

    fun updatePlace(
        placeId: String,
        name: String,
        address: String,
        onSuccess: (id: String, name: String, address: String, located: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val place =
                    familyClient.updatePlace(
                        session.requireAccessToken(),
                        placeId,
                        name.trim(),
                        address.trim(),
                    )
                onSuccess(place.id, place.name, place.address, if (place.isLocated()) "true" else "false")
            } catch (e: Throwable) {
                onError(e.message ?: "Update place failed")
            }
        }
    }

    fun removePlace(
        placeId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.deletePlace(session.requireAccessToken(), placeId)
                onSuccess()
            } catch (e: Throwable) {
                onError(e.message ?: "Remove place failed")
            }
        }
    }

    fun locatePlace(
        placeId: String,
        onSuccess: (id: String, name: String, address: String, located: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val place = familyClient.locatePlace(session.requireAccessToken(), placeId)
                onSuccess(place.id, place.name, place.address, if (place.isLocated()) "true" else "false")
            } catch (e: Throwable) {
                onError(e.message ?: "Locate place failed")
            }
        }
    }

    fun listFeeds(
        onSuccess: (
            ids: List<String>,
            names: List<String>,
            sourceUrls: List<String>,
            kidIdsJoined: List<String>,
            lastSyncedAts: List<String>,
            lastSyncErrors: List<String>,
            eventCounts: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val feeds = familyClient.listFeeds(session.requireAccessToken())
                onSuccess(
                    feeds.map { it.id },
                    feeds.map { it.name },
                    feeds.map { it.sourceUrl },
                    feeds.map { it.kidIds.joinToString(",") },
                    feeds.map { it.lastSyncedAt.orEmpty() },
                    feeds.map { it.lastSyncError.orEmpty() },
                    feeds.map { it.eventCount.toString() },
                )
            } catch (e: Throwable) {
                onError(e.message ?: "List feeds failed")
            }
        }
    }

    fun createFeed(
        name: String,
        sourceUrl: String,
        kidIds: List<String>,
        onSuccess: (String, String, String, List<String>, String, String, String) -> Unit,
        onError: (String) -> Unit,
    ) = feedResult(
        { familyClient.createFeed(session.requireAccessToken(), name.trim(), sourceUrl.trim(), kidIds) },
        onSuccess,
        onError,
    )

    fun updateFeed(
        feedId: String,
        name: String,
        sourceUrl: String,
        kidIds: List<String>,
        onSuccess: (String, String, String, List<String>, String, String, String) -> Unit,
        onError: (String) -> Unit,
    ) = feedResult(
        { familyClient.updateFeed(session.requireAccessToken(), feedId, name.trim(), sourceUrl.trim(), kidIds) },
        onSuccess,
        onError,
    )

    fun deleteFeed(
        feedId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.deleteFeed(session.requireAccessToken(), feedId)
                onSuccess()
            } catch (e: Throwable) {
                onError(e.message ?: "Delete feed failed")
            }
        }
    }

    fun syncFeed(
        feedId: String,
        onSuccess: (String, String, String, List<String>, String, String, String) -> Unit,
        onError: (String) -> Unit,
    ) = feedResult(
        { familyClient.syncFeed(session.requireAccessToken(), feedId) },
        onSuccess,
        onError,
    )

    private fun feedResult(
        request: suspend () -> ActivityFeed,
        onSuccess: (String, String, String, List<String>, String, String, String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val feed = request()
                onSuccess(
                    feed.id,
                    feed.name,
                    feed.sourceUrl,
                    feed.kidIds,
                    feed.lastSyncedAt.orEmpty(),
                    feed.lastSyncError.orEmpty(),
                    feed.eventCount.toString(),
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Feed request failed")
            }
        }
    }

    private suspend fun emitReady(
        adult: Adult,
        circle: FamilyCircle,
        token: String,
        onReady: (
            title: String,
            email: String,
            adultId: String,
            displayName: String?,
            role: String,
            inviteCode: String?,
            memberAdultIds: List<String>,
            memberEmails: List<String>,
            memberNames: List<String>,
            memberRoles: List<String>,
            kidIds: List<String>,
            kidNames: List<String>,
            placeIds: List<String>,
            placeNames: List<String>,
            placeAddresses: List<String>,
            placeLocated: List<String>,
        ) -> Unit,
    ) {
        val inviteCode =
            if (circle.role == FamilyRole.ORGANIZER) {
                runCatching { familyClient.getInvite(token).code }.getOrNull()
            } else {
                null
            }
        onReady(
            circle.displayTitle(),
            adult.email,
            adult.id,
            adult.displayName,
            circle.role.name,
            inviteCode,
            circle.members.map { it.adultId },
            circle.members.map { it.email },
            circle.members.map { it.displayName ?: "" },
            circle.members.map { it.role.name },
            circle.kids.map { it.id },
            circle.kids.map { it.displayName },
            circle.places.map { it.id },
            circle.places.map { it.name },
            circle.places.map { it.address },
            circle.places.map { if (it.isLocated()) "true" else "false" },
        )
    }
}
