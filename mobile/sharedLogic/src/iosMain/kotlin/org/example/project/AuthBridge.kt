package org.example.project

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Swift-friendly bridge for email OTP auth + family circle on iOS. */
class AuthBridge {
    private val session: AuthSession
    private val familyClient: FamilyClient
    private val carpoolClient: CarpoolClient
    private val scope: CoroutineScope
    private val calendarCache: CalendarCacheStore
    private val bootstrapCache: FamilyBootstrapCache
    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    private var activeCircleId: String? = null
    private var activeAdultId: String? = null

    constructor() {
        session =
            AuthSession(
                client = AuthClient.create(),
                tokenStore = IosSecureTokenStore(),
            )
        familyClient = FamilyClient.create()
        carpoolClient = CarpoolClient.create()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        calendarCache = IosCalendarCacheStore()
        bootstrapCache = IosFamilyBootstrapCache()
    }

    constructor(session: AuthSession, familyClient: FamilyClient, scope: CoroutineScope) :
        this(session, familyClient, scope, InMemoryCalendarCacheStore(), InMemoryFamilyBootstrapCache())

    constructor(
        session: AuthSession,
        familyClient: FamilyClient,
        scope: CoroutineScope,
        calendarCache: CalendarCacheStore,
        bootstrapCache: FamilyBootstrapCache = InMemoryFamilyBootstrapCache(),
        carpoolClient: CarpoolClient = CarpoolClient.create(),
    ) {
        this.session = session
        this.familyClient = familyClient
        this.carpoolClient = carpoolClient
        this.scope = scope
        this.calendarCache = calendarCache
        this.bootstrapCache = bootstrapCache
    }

    private fun encodeCoverages(coverages: List<CalendarCoverageAssignment>): String =
        json.encodeToString(ListSerializer(CalendarCoverageAssignment.serializer()), coverages)

    private fun encodeConflicts(conflicts: List<CalendarConflict>): String =
        json.encodeToString(ListSerializer(CalendarConflict.serializer()), conflicts)

    private fun encodeRsvps(rsvps: List<CalendarRsvp>): String =
        json.encodeToString(ListSerializer(CalendarRsvp.serializer()), rsvps)

    private fun calendarItemSuccessArgs(item: CalendarItem): CalendarItemBridgeArgs =
        CalendarItemBridgeArgs(
            id = item.id,
            source = item.source.name,
            title = item.title,
            startsAt = item.startsAt,
            endsAt = item.endsAt.orEmpty(),
            location = item.location.orEmpty(),
            kidIdsJoined = item.kidIds.joinToString(","),
            feedId = item.feedId.orEmpty(),
            feedName = item.feedName.orEmpty(),
            leaveFromPlaceId = item.leaveFromPlaceId.orEmpty(),
            leaveFromPlaceName = item.leaveFromPlaceName.orEmpty(),
            leaveByAt = item.leaveByAt.orEmpty(),
            leaveByStatus = item.leaveByStatus.name,
            leaveByReason = item.leaveByReason.orEmpty(),
            coveragesJson = encodeCoverages(item.coverages),
            uncoveredKidIdsJoined = item.uncoveredKidIds.joinToString(","),
            conflictsJson = encodeConflicts(item.conflicts),
            rsvpsJson = encodeRsvps(item.rsvps),
        )

    private data class CalendarItemBridgeArgs(
        val id: String,
        val source: String,
        val title: String,
        val startsAt: String,
        val endsAt: String,
        val location: String,
        val kidIdsJoined: String,
        val feedId: String,
        val feedName: String,
        val leaveFromPlaceId: String,
        val leaveFromPlaceName: String,
        val leaveByAt: String,
        val leaveByStatus: String,
        val leaveByReason: String,
        val coveragesJson: String,
        val uncoveredKidIdsJoined: String,
        val conflictsJson: String,
        val rsvpsJson: String,
    )

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
                // Do not clear calendar cache on logout — same adult should paint Agenda on
                // the next sign-in (keyed by adultId+circleId). Leave-circle clears the key.
                activeCircleId = null
                activeAdultId = null
                session.logout()
                onSuccess()
            } catch (e: Throwable) {
                // AuthSession.logout clears the token in finally even when the server call fails.
                // Treat a cleared session as signed-out success so iOS never stays "signed in"
                // with no token.
                activeCircleId = null
                activeAdultId = null
                if (!session.isSignedIn()) {
                    onSuccess()
                } else {
                    onError(e.message ?: "Logout failed")
                }
            }
        }
    }

    fun isSignedIn(): Boolean = session.isSignedIn()

    /**
     * Synchronously paint last Ready shell (and set active adult/circle for calendar peek).
     * Call before [loadFamily] so Agenda is never blank while getCircle is in flight.
     */
    fun paintBootstrapIfPresent(
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
            defaultLeaveFromPlaceId: String,
            defaultLeaveFromPlaceName: String,
        ) -> Unit,
    ): Boolean {
        if (!session.isSignedIn()) return false
        val adultId =
            activeAdultId
                ?: bootstrapCache.lastAdultId()
                ?: return false
        val snap = bootstrapCache.load(adultId) ?: return false
        activeAdultId = snap.adultId
        activeCircleId = snap.circle.id
        val circle = snap.circle
        onReady(
            circle.displayTitle(),
            snap.email,
            snap.adultId,
            snap.adultDisplayName,
            circle.role.name,
            snap.inviteCode,
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
            circle.defaultLeaveFromPlaceId.orEmpty(),
            circle.defaultLeaveFromPlaceName.orEmpty(),
        )
        return true
    }

    /** Paint last feeds from bootstrap (same List→Array bridging as [listFeeds]). */
    fun peekBootstrapFeeds(
        onHit: (
            ids: List<String>,
            names: List<String>,
            sourceUrls: List<String>,
            kidIdsJoined: List<String>,
            lastSyncedAts: List<String>,
            lastSyncErrors: List<String>,
            eventCounts: List<String>,
        ) -> Unit,
    ): Boolean {
        val adultId = activeAdultId ?: bootstrapCache.lastAdultId() ?: return false
        val feeds = bootstrapCache.load(adultId)?.feeds ?: return false
        if (feeds.isEmpty()) return false
        onHit(
            feeds.map { it.id },
            feeds.map { it.name },
            feeds.map { it.sourceUrl },
            feeds.map { it.kidIds.joinToString(",") },
            feeds.map { it.lastSyncedAt.orEmpty() },
            feeds.map { it.lastSyncError.orEmpty() },
            feeds.map { it.eventCount.toString() },
        )
        return true
    }

    private fun persistBootstrapFeeds(feeds: List<ActivityFeed>) {
        val adultId = activeAdultId ?: return
        val existing = bootstrapCache.load(adultId) ?: return
        bootstrapCache.save(existing.copy(feeds = feeds))
    }

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
            defaultLeaveFromPlaceId: String,
            defaultLeaveFromPlaceName: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val adult = session.currentAdult()
                val token = session.requireAccessToken()
                val circle = familyClient.getCircle(token)
                if (circle == null) {
                    bootstrapCache.clear(adult.id)
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
            defaultLeaveFromPlaceId: String,
            defaultLeaveFromPlaceName: String,
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
            defaultLeaveFromPlaceId: String,
            defaultLeaveFromPlaceName: String,
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

    /** Non-blocking invite fetch so Ready can paint Agenda from cache first. */
    fun loadInvite(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val invite = familyClient.getInvite(session.requireAccessToken())
                val adultId = activeAdultId
                if (adultId != null) {
                    bootstrapCache.load(adultId)?.let { existing ->
                        bootstrapCache.save(existing.copy(inviteCode = invite.code))
                    }
                }
                onSuccess(invite.code)
            } catch (e: Throwable) {
                onError(e.message ?: "Invite failed")
            }
        }
    }

    fun leaveFamily(
        onSuccess: (email: String, hasDisplayName: Boolean) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                clearActiveCalendarCache()
                bootstrapCache.clear(activeAdultId ?: session.currentAdult().id)
                familyClient.leaveCircle(session.requireAccessToken())
                activeCircleId = null
                activeAdultId = null
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
            defaultLeaveFromPlaceId: String,
            defaultLeaveFromPlaceName: String,
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

    fun getGarage(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val garage = familyClient.getGarage(session.requireAccessToken())
                onSuccess(json.encodeToString(Garage.serializer(), garage))
            } catch (e: Throwable) {
                onError(e.message ?: "Get garage failed")
            }
        }
    }

    fun patchGarageDrives(
        drives: Boolean,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val garage = familyClient.patchGarageDrives(session.requireAccessToken(), drives)
                onSuccess(json.encodeToString(Garage.serializer(), garage))
            } catch (e: Throwable) {
                onError(e.message ?: "Update drives failed")
            }
        }
    }

    fun listGarageMakes(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val makes = familyClient.listGarageMakes(session.requireAccessToken())
                onSuccess(json.encodeToString(ListSerializer(VehicleMake.serializer()), makes))
            } catch (e: Throwable) {
                onError(e.message ?: "List vehicle makes failed")
            }
        }
    }

    fun listGarageModels(
        year: Int,
        make: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val models = familyClient.listGarageModels(session.requireAccessToken(), year, make)
                onSuccess(json.encodeToString(ListSerializer(VehicleModel.serializer()), models))
            } catch (e: Throwable) {
                onError(e.message ?: "List vehicle models failed")
            }
        }
    }

    fun suggestGarageSeats(
        year: Int,
        make: String,
        model: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val hint =
                    familyClient.suggestGarageSeats(
                        session.requireAccessToken(),
                        year,
                        make,
                        model,
                    )
                onSuccess(hint.seats?.toString() ?: "")
            } catch (e: Throwable) {
                onError(e.message ?: "Suggest seats failed")
            }
        }
    }

    fun addVehicle(
        label: String,
        year: Int,
        make: String,
        model: String,
        seats: Int,
        driverAdultIds: List<String>,
        keptAtPlaceId: String?,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = vehicleMutation(
        {
            familyClient.addVehicle(
                session.requireAccessToken(),
                CreateVehicleRequest(
                    label = label.trim(),
                    year = year,
                    make = make,
                    model = model,
                    seats = seats,
                    driverAdultIds = driverAdultIds,
                    keptAtPlaceId = keptAtPlaceId?.takeIf { it.isNotBlank() },
                ),
            )
        },
        onSuccess,
        onError,
    )

    fun updateVehicle(
        vehicleId: String,
        label: String,
        year: Int,
        make: String,
        model: String,
        seats: Int,
        driverAdultIds: List<String>,
        keptAtPlaceId: String?,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = vehicleMutation(
        {
            familyClient.updateVehicle(
                session.requireAccessToken(),
                vehicleId,
                UpdateVehicleRequest(
                    label = label.trim(),
                    year = year,
                    make = make,
                    model = model,
                    seats = seats,
                    driverAdultIds = driverAdultIds,
                    keptAtPlaceId = keptAtPlaceId?.takeIf { it.isNotBlank() },
                ),
            )
        },
        onSuccess,
        onError,
    )

    fun deleteVehicle(
        vehicleId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.deleteVehicle(session.requireAccessToken(), vehicleId)
                val garage = familyClient.getGarage(session.requireAccessToken())
                onSuccess(json.encodeToString(Garage.serializer(), garage))
            } catch (e: Throwable) {
                onError(e.message ?: "Delete vehicle failed")
            }
        }
    }

    private fun vehicleMutation(
        action: suspend () -> Vehicle,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                action()
                val garage = familyClient.getGarage(session.requireAccessToken())
                onSuccess(json.encodeToString(Garage.serializer(), garage))
            } catch (e: Throwable) {
                onError(e.message ?: "Save vehicle failed")
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
                persistBootstrapFeeds(feeds)
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

    fun getCarpoolSummary(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val summary = carpoolClient.getSummary(session.requireAccessToken())
                onSuccess(encodeCarpoolSummary(summary))
            } catch (e: Throwable) {
                onError(e.message ?: "Get carpool summary failed")
            }
        }
    }

    fun enableCarpool(
        feedId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation({ carpoolClient.enable(session.requireAccessToken(), feedId) }, onSuccess, onError)

    fun joinCarpool(
        code: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation({ carpoolClient.join(session.requireAccessToken(), code.trim()) }, onSuccess, onError)

    fun requestCarpool(
        spaceId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation(
        { carpoolClient.createRequest(session.requireAccessToken(), spaceId) },
        onSuccess,
        onError,
    )

    fun admitCarpoolRequest(
        spaceId: String,
        requestId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation(
        { carpoolClient.admit(session.requireAccessToken(), spaceId, requestId) },
        onSuccess,
        onError,
    )

    fun declineCarpoolRequest(
        spaceId: String,
        requestId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation(
        { carpoolClient.decline(session.requireAccessToken(), spaceId, requestId) },
        onSuccess,
        onError,
    )

    fun regenerateCarpoolInvite(
        spaceId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation(
        { carpoolClient.regenerateInvite(session.requireAccessToken(), spaceId) },
        onSuccess,
        onError,
    )

    fun leaveCarpool(
        spaceId: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) = carpoolMutation(
        { carpoolClient.leave(session.requireAccessToken(), spaceId) },
        onSuccess,
        onError,
    )

    fun carpoolFeedStatusLabel(status: String): String =
        runCatching { CarpoolFeedStatusKind.valueOf(status).statusLabel() }
            .getOrDefault(status)

    fun carpoolEmptyHint(circleRole: String): String =
        if (circleRole == FamilyRole.ORGANIZER.name) {
            CarpoolSummary(circleRole = FamilyRole.ORGANIZER).emptyHint()
        } else {
            CarpoolSummary(circleRole = FamilyRole.CAREGIVER).emptyHint()
        }

    fun enableCarpoolConfirmMessageBridge(feedName: String): String = enableCarpoolConfirmMessage(feedName)

    fun circleDisplayNameBridge(name: String?): String = circleDisplayName(name)

    private fun carpoolMutation(
        action: suspend () -> Unit,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                action()
                val summary = carpoolClient.getSummary(session.requireAccessToken())
                onSuccess(encodeCarpoolSummary(summary))
            } catch (e: Throwable) {
                onError(e.message ?: "Carpool request failed")
            }
        }
    }

    private fun encodeCarpoolSummary(summary: CarpoolSummary): String =
        json.encodeToString(CarpoolSummary.serializer(), summary)

    fun listCalendar(
        from: String,
        to: String,
        onSuccess: (
            ids: List<String>,
            sources: List<String>,
            titles: List<String>,
            startsAts: List<String>,
            endsAts: List<String>,
            locations: List<String>,
            kidIdsJoined: List<String>,
            feedIds: List<String>,
            feedNames: List<String>,
            leaveFromPlaceIds: List<String>,
            leaveFromPlaceNames: List<String>,
            leaveByAts: List<String>,
            leaveByStatuses: List<String>,
            leaveByReasons: List<String>,
            coveragesJson: List<String>,
            uncoveredKidIdsJoined: List<String>,
            conflictsJson: List<String>,
            rsvpsJson: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val items = familyClient.listCalendar(session.requireAccessToken(), from, to)
                onSuccess(
                    items.map { it.id },
                    items.map { it.source.name },
                    items.map { it.title },
                    items.map { it.startsAt },
                    items.map { it.endsAt.orEmpty() },
                    items.map { it.location.orEmpty() },
                    items.map { it.kidIds.joinToString(",") },
                    items.map { it.feedId.orEmpty() },
                    items.map { it.feedName.orEmpty() },
                    items.map { it.leaveFromPlaceId.orEmpty() },
                    items.map { it.leaveFromPlaceName.orEmpty() },
                    items.map { it.leaveByAt.orEmpty() },
                    items.map { it.leaveByStatus.name },
                    items.map { it.leaveByReason.orEmpty() },
                    items.map { encodeCoverages(it.coverages) },
                    items.map { it.uncoveredKidIds.joinToString(",") },
                    items.map { encodeConflicts(it.conflicts) },
                    items.map { encodeRsvps(it.rsvps) },
                )
            } catch (e: Throwable) {
                onError(e.message ?: "List calendar failed")
            }
        }
    }

    fun listCalendarLeaveBy(
        from: String,
        to: String,
        onSuccess: (
            ids: List<String>,
            sources: List<String>,
            leaveFromPlaceIds: List<String>,
            leaveFromPlaceNames: List<String>,
            leaveByAts: List<String>,
            leaveByStatuses: List<String>,
            leaveByReasons: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val rows = familyClient.listCalendarLeaveBy(session.requireAccessToken(), from, to)
                onSuccess(
                    rows.map { it.id },
                    rows.map { it.source.name },
                    rows.map { it.leaveFromPlaceId.orEmpty() },
                    rows.map { it.leaveFromPlaceName.orEmpty() },
                    rows.map { it.leaveByAt.orEmpty() },
                    rows.map { it.leaveByStatus.name },
                    rows.map { it.leaveByReason.orEmpty() },
                )
            } catch (e: Throwable) {
                onError(e.message ?: "List calendar leave-by failed")
            }
        }
    }

    fun setCalendarLeaveFrom(
        source: String,
        itemId: String,
        placeId: String,
        onSuccess: (
            id: String,
            source: String,
            title: String,
            startsAt: String,
            endsAt: String,
            location: String,
            kidIdsJoined: String,
            feedId: String,
            feedName: String,
            leaveFromPlaceId: String,
            leaveFromPlaceName: String,
            leaveByAt: String,
            leaveByStatus: String,
            leaveByReason: String,
            coveragesJson: String,
            uncoveredKidIdsJoined: String,
            conflictsJson: String,
            rsvpsJson: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val item =
                    familyClient.setCalendarLeaveFrom(
                        session.requireAccessToken(),
                        CalendarItemSource.valueOf(source),
                        itemId,
                        SetCalendarLeaveFromRequest(leaveFromPlaceId = placeId),
                    )
                val args = calendarItemSuccessArgs(item)
                onSuccess(
                    args.id,
                    args.source,
                    args.title,
                    args.startsAt,
                    args.endsAt,
                    args.location,
                    args.kidIdsJoined,
                    args.feedId,
                    args.feedName,
                    args.leaveFromPlaceId,
                    args.leaveFromPlaceName,
                    args.leaveByAt,
                    args.leaveByStatus,
                    args.leaveByReason,
                    args.coveragesJson,
                    args.uncoveredKidIdsJoined,
                    args.conflictsJson,
                    args.rsvpsJson,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Set leave-from failed")
            }
        }
    }


    fun setCalendarRsvp(
        source: String,
        itemId: String,
        kidId: String,
        status: String,
        onSuccess: (
            id: String,
            source: String,
            title: String,
            startsAt: String,
            endsAt: String,
            location: String,
            kidIdsJoined: String,
            feedId: String,
            feedName: String,
            leaveFromPlaceId: String,
            leaveFromPlaceName: String,
            leaveByAt: String,
            leaveByStatus: String,
            leaveByReason: String,
            coveragesJson: String,
            uncoveredKidIdsJoined: String,
            conflictsJson: String,
            rsvpsJson: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val item =
                    familyClient.setCalendarRsvp(
                        session.requireAccessToken(),
                        CalendarItemSource.valueOf(source),
                        itemId,
                        kidId,
                        SetCalendarRsvpRequest(status = RsvpStatus.valueOf(status)),
                    )
                val args = calendarItemSuccessArgs(item)
                onSuccess(
                    args.id,
                    args.source,
                    args.title,
                    args.startsAt,
                    args.endsAt,
                    args.location,
                    args.kidIdsJoined,
                    args.feedId,
                    args.feedName,
                    args.leaveFromPlaceId,
                    args.leaveFromPlaceName,
                    args.leaveByAt,
                    args.leaveByStatus,
                    args.leaveByReason,
                    args.coveragesJson,
                    args.uncoveredKidIdsJoined,
                    args.conflictsJson,
                    args.rsvpsJson,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Set RSVP failed")
            }
        }
    }

    fun setDefaultLeaveFrom(
        placeId: String?,
        onSuccess: (placeId: String, placeName: String) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val circle =
                    familyClient.setDefaultLeaveFrom(
                        session.requireAccessToken(),
                        SetDefaultLeaveFromRequest(placeId = placeId),
                    )
                onSuccess(
                    circle.defaultLeaveFromPlaceId.orEmpty(),
                    circle.defaultLeaveFromPlaceName.orEmpty(),
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Set default leave-from failed")
            }
        }
    }

    fun assignCalendarCoverage(
        source: String,
        itemId: String,
        coveringAdultId: String,
        kidIds: List<String>,
        onSuccess: (
            id: String,
            source: String,
            title: String,
            startsAt: String,
            endsAt: String,
            location: String,
            kidIdsJoined: String,
            feedId: String,
            feedName: String,
            leaveFromPlaceId: String,
            leaveFromPlaceName: String,
            leaveByAt: String,
            leaveByStatus: String,
            leaveByReason: String,
            coveragesJson: String,
            uncoveredKidIdsJoined: String,
            conflictsJson: String,
            rsvpsJson: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val item =
                    familyClient.assignCalendarCoverage(
                        session.requireAccessToken(),
                        CalendarItemSource.valueOf(source),
                        itemId,
                        AssignCalendarCoverageRequest(
                            coveringAdultId = coveringAdultId.trim(),
                            kidIds = kidIds.map { it.trim() }.filter { it.isNotEmpty() },
                        ),
                    )
                val args = calendarItemSuccessArgs(item)
                onSuccess(
                    args.id,
                    args.source,
                    args.title,
                    args.startsAt,
                    args.endsAt,
                    args.location,
                    args.kidIdsJoined,
                    args.feedId,
                    args.feedName,
                    args.leaveFromPlaceId,
                    args.leaveFromPlaceName,
                    args.leaveByAt,
                    args.leaveByStatus,
                    args.leaveByReason,
                    args.coveragesJson,
                    args.uncoveredKidIdsJoined,
                    args.conflictsJson,
                    args.rsvpsJson,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Assign coverage failed")
            }
        }
    }

    fun confirmCalendarCoverage(
        assignmentId: String,
        onSuccess: (
            id: String,
            source: String,
            title: String,
            startsAt: String,
            endsAt: String,
            location: String,
            kidIdsJoined: String,
            feedId: String,
            feedName: String,
            leaveFromPlaceId: String,
            leaveFromPlaceName: String,
            leaveByAt: String,
            leaveByStatus: String,
            leaveByReason: String,
            coveragesJson: String,
            uncoveredKidIdsJoined: String,
            conflictsJson: String,
            rsvpsJson: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val item =
                    familyClient.confirmCalendarCoverage(
                        session.requireAccessToken(),
                        assignmentId,
                    )
                val args = calendarItemSuccessArgs(item)
                onSuccess(
                    args.id,
                    args.source,
                    args.title,
                    args.startsAt,
                    args.endsAt,
                    args.location,
                    args.kidIdsJoined,
                    args.feedId,
                    args.feedName,
                    args.leaveFromPlaceId,
                    args.leaveFromPlaceName,
                    args.leaveByAt,
                    args.leaveByStatus,
                    args.leaveByReason,
                    args.coveragesJson,
                    args.uncoveredKidIdsJoined,
                    args.conflictsJson,
                    args.rsvpsJson,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Confirm coverage failed")
            }
        }
    }

    fun declineCalendarCoverage(
        assignmentId: String,
        onSuccess: (
            id: String,
            source: String,
            title: String,
            startsAt: String,
            endsAt: String,
            location: String,
            kidIdsJoined: String,
            feedId: String,
            feedName: String,
            leaveFromPlaceId: String,
            leaveFromPlaceName: String,
            leaveByAt: String,
            leaveByStatus: String,
            leaveByReason: String,
            coveragesJson: String,
            uncoveredKidIdsJoined: String,
            conflictsJson: String,
            rsvpsJson: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val item =
                    familyClient.declineCalendarCoverage(
                        session.requireAccessToken(),
                        assignmentId,
                    )
                val args = calendarItemSuccessArgs(item)
                onSuccess(
                    args.id,
                    args.source,
                    args.title,
                    args.startsAt,
                    args.endsAt,
                    args.location,
                    args.kidIdsJoined,
                    args.feedId,
                    args.feedName,
                    args.leaveFromPlaceId,
                    args.leaveFromPlaceName,
                    args.leaveByAt,
                    args.leaveByStatus,
                    args.leaveByReason,
                    args.coveragesJson,
                    args.uncoveredKidIdsJoined,
                    args.conflictsJson,
                    args.rsvpsJson,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Decline coverage failed")
            }
        }
    }

    fun removeCalendarCoverage(
        assignmentId: String,
        onSuccess: (
            id: String,
            source: String,
            title: String,
            startsAt: String,
            endsAt: String,
            location: String,
            kidIdsJoined: String,
            feedId: String,
            feedName: String,
            leaveFromPlaceId: String,
            leaveFromPlaceName: String,
            leaveByAt: String,
            leaveByStatus: String,
            leaveByReason: String,
            coveragesJson: String,
            uncoveredKidIdsJoined: String,
            conflictsJson: String,
            rsvpsJson: String,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val item =
                    familyClient.removeCalendarCoverage(
                        session.requireAccessToken(),
                        assignmentId,
                    )
                val args = calendarItemSuccessArgs(item)
                onSuccess(
                    args.id,
                    args.source,
                    args.title,
                    args.startsAt,
                    args.endsAt,
                    args.location,
                    args.kidIdsJoined,
                    args.feedId,
                    args.feedName,
                    args.leaveFromPlaceId,
                    args.leaveFromPlaceName,
                    args.leaveByAt,
                    args.leaveByStatus,
                    args.leaveByReason,
                    args.coveragesJson,
                    args.uncoveredKidIdsJoined,
                    args.conflictsJson,
                    args.rsvpsJson,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Remove coverage failed")
            }
        }
    }

    fun listEvents(
        onSuccess: (
            ids: List<String>,
            titles: List<String>,
            startsAts: List<String>,
            endsAts: List<String>,
            locations: List<String>,
            kidIdsJoined: List<String>,
        ) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val events = familyClient.listEvents(session.requireAccessToken())
                onSuccess(
                    events.map { it.id },
                    events.map { it.title },
                    events.map { it.startsAt },
                    events.map { it.endsAt.orEmpty() },
                    events.map { it.location.orEmpty() },
                    events.map { it.kidIds.joinToString(",") },
                )
            } catch (e: Throwable) {
                onError(e.message ?: "List events failed")
            }
        }
    }

    fun createEvent(
        title: String,
        startsAt: String,
        endsAt: String,
        location: String,
        kidIds: List<String>,
        onSuccess: (String, String, String, String, String, List<String>) -> Unit,
        onError: (String) -> Unit,
    ) = eventResult(
        {
            familyClient.createEvent(
                session.requireAccessToken(),
                title.trim(),
                startsAt.trim(),
                kidIds,
                endsAt.trim().ifEmpty { null },
                location.trim().ifEmpty { null },
            )
        },
        onSuccess,
        onError,
    )

    fun updateEvent(
        eventId: String,
        title: String,
        startsAt: String,
        endsAt: String,
        location: String,
        kidIds: List<String>,
        onSuccess: (String, String, String, String, String, List<String>) -> Unit,
        onError: (String) -> Unit,
    ) = eventResult(
        {
            familyClient.updateEvent(
                session.requireAccessToken(),
                eventId,
                title.trim(),
                startsAt.trim(),
                kidIds,
                endsAt.trim().ifEmpty { null },
                location.trim().ifEmpty { null },
            )
        },
        onSuccess,
        onError,
    )

    fun removeEvent(
        eventId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                familyClient.deleteEvent(session.requireAccessToken(), eventId)
                onSuccess()
            } catch (e: Throwable) {
                onError(e.message ?: "Delete event failed")
            }
        }
    }

    private fun eventResult(
        request: suspend () -> ManualEvent,
        onSuccess: (String, String, String, String, String, List<String>) -> Unit,
        onError: (String) -> Unit,
    ) {
        scope.launch {
            try {
                val event = request()
                onSuccess(
                    event.id,
                    event.title,
                    event.startsAt,
                    event.endsAt.orEmpty(),
                    event.location.orEmpty(),
                    event.kidIds,
                )
            } catch (e: Throwable) {
                onError(e.message ?: "Event request failed")
            }
        }
    }

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
        @Suppress("UNUSED_PARAMETER") token: String,
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
            defaultLeaveFromPlaceId: String,
            defaultLeaveFromPlaceName: String,
        ) -> Unit,
    ) {
        activeCircleId = circle.id
        activeAdultId = adult.id
        // Do not await getInvite here — it blocked Ready/Agenda paint-from-cache on login.
        // Organizers load the invite asynchronously via [loadInvite] after Ready.
        val previous = bootstrapCache.load(adult.id)
        onReady(
            circle.displayTitle(),
            adult.email,
            adult.id,
            adult.displayName,
            circle.role.name,
            previous?.inviteCode,
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
            circle.defaultLeaveFromPlaceId.orEmpty(),
            circle.defaultLeaveFromPlaceName.orEmpty(),
        )
        bootstrapCache.save(
            FamilyBootstrapSnapshot(
                adultId = adult.id,
                email = adult.email,
                adultDisplayName = adult.displayName,
                circle = circle,
                inviteCode = previous?.inviteCode,
                feeds = previous?.feeds ?: emptyList(),
            ),
        )
    }

    /** Soft TTL used by Swift Agenda revalidate-on-return. */
    fun calendarCacheSoftTtlMs(): Long = CALENDAR_CACHE_SOFT_TTL_MS

    fun isCalendarCacheStale(
        fetchedAt: Long,
        nowMs: Long,
    ): Boolean = calendarCache.isStale(fetchedAt, nowMs)

    fun clearAllCalendarCaches() {
        calendarCache.clearAll()
        activeCircleId = null
        activeAdultId = null
    }

    fun clearActiveCalendarCache() {
        val adultId = activeAdultId ?: return
        val circleId = activeCircleId ?: return
        calendarCache.clear(adultId, circleId)
    }

    /**
     * Paint-from-cache using the same List→Swift Array callback bridging as [listCalendar].
     * Returns true when [onHit] was invoked.
     */
    fun peekCalendarCache(
        onHit: (
            from: String,
            to: String,
            fetchedAt: Long,
            ids: List<String>,
            sources: List<String>,
            titles: List<String>,
            startsAts: List<String>,
            endsAts: List<String>,
            locations: List<String>,
            kidIdsJoined: List<String>,
            feedIds: List<String>,
            feedNames: List<String>,
            leaveFromPlaceIds: List<String>,
            leaveFromPlaceNames: List<String>,
            leaveByAts: List<String>,
            leaveByStatuses: List<String>,
            leaveByReasons: List<String>,
            coveragesJson: List<String>,
            uncoveredKidIdsJoined: List<String>,
            conflictsJson: List<String>,
            rsvpsJson: List<String>,
        ) -> Unit,
    ): Boolean {
        val adultId = activeAdultId ?: return false
        val circleId = activeCircleId ?: return false
        val snap = calendarCache.load(adultId, circleId) ?: return false
        val hit = snap.toBridgeHit()
        onHit(
            hit.from,
            hit.to,
            hit.fetchedAt,
            hit.ids,
            hit.sources,
            hit.titles,
            hit.startsAts,
            hit.endsAts,
            hit.locations,
            hit.kidIdsJoined,
            hit.feedIds,
            hit.feedNames,
            hit.leaveFromPlaceIds,
            hit.leaveFromPlaceNames,
            hit.leaveByAts,
            hit.leaveByStatuses,
            hit.leaveByReasons,
            hit.coveragesJson,
            hit.uncoveredKidIdsJoined,
            hit.conflictsJson,
            hit.rsvpsJson,
        )
        return true
    }

    fun saveCalendarCache(
        from: String,
        to: String,
        fetchedAt: Long,
        ids: List<String>,
        sources: List<String>,
        titles: List<String>,
        startsAts: List<String>,
        endsAts: List<String>,
        locations: List<String>,
        kidIdsJoined: List<String>,
        feedIds: List<String>,
        feedNames: List<String>,
        leaveFromPlaceIds: List<String>,
        leaveFromPlaceNames: List<String>,
        leaveByAts: List<String>,
        leaveByStatuses: List<String>,
        leaveByReasons: List<String>,
        coveragesJson: List<String>,
        uncoveredKidIdsJoined: List<String>,
        conflictsJson: List<String>,
        rsvpsJson: List<String>,
    ): Boolean {
        val adultId = activeAdultId ?: return false
        val circleId = activeCircleId ?: return false
        return try {
            val items =
                itemsFromParallel(
                    ids,
                    sources,
                    titles,
                    startsAts,
                    endsAts,
                    locations,
                    kidIdsJoined,
                    feedIds,
                    feedNames,
                    leaveFromPlaceIds,
                    leaveFromPlaceNames,
                    leaveByAts,
                    leaveByStatuses,
                    leaveByReasons,
                    coveragesJson,
                    uncoveredKidIdsJoined,
                    conflictsJson,
                    rsvpsJson,
                )
            calendarCache.save(
                CalendarCacheSnapshot(
                    adultId = adultId,
                    circleId = circleId,
                    from = from,
                    to = to,
                    items = items,
                    fetchedAt = fetchedAt,
                ),
            )
            true
        } catch (_: Throwable) {
            false
        }
    }

    fun patchCalendarCacheItem(
        id: String,
        source: String,
        title: String,
        startsAt: String,
        endsAt: String,
        location: String,
        kidIdsJoined: String,
        feedId: String,
        feedName: String,
        leaveFromPlaceId: String,
        leaveFromPlaceName: String,
        leaveByAt: String,
        leaveByStatus: String,
        leaveByReason: String,
        coveragesJson: String,
        uncoveredKidIdsJoined: String,
        conflictsJson: String,
        rsvpsJson: String,
    ) {
        val adultId = activeAdultId ?: return
        val circleId = activeCircleId ?: return
        val updated =
            itemsFromParallel(
                listOf(id),
                listOf(source),
                listOf(title),
                listOf(startsAt),
                listOf(endsAt),
                listOf(location),
                listOf(kidIdsJoined),
                listOf(feedId),
                listOf(feedName),
                listOf(leaveFromPlaceId),
                listOf(leaveFromPlaceName),
                listOf(leaveByAt),
                listOf(leaveByStatus),
                listOf(leaveByReason),
                listOf(coveragesJson),
                listOf(uncoveredKidIdsJoined),
                listOf(conflictsJson),
                listOf(rsvpsJson),
            ).single()
        calendarCache.patchItem(adultId, circleId, updated)
    }

    private fun CalendarCacheSnapshot.toBridgeHit(): CalendarCacheBridgeHit =
        CalendarCacheBridgeHit(
            from = from,
            to = to,
            fetchedAt = fetchedAt,
            ids = items.map { it.id },
            sources = items.map { it.source.name },
            titles = items.map { it.title },
            startsAts = items.map { it.startsAt },
            endsAts = items.map { it.endsAt.orEmpty() },
            locations = items.map { it.location.orEmpty() },
            kidIdsJoined = items.map { it.kidIds.joinToString(",") },
            feedIds = items.map { it.feedId.orEmpty() },
            feedNames = items.map { it.feedName.orEmpty() },
            leaveFromPlaceIds = items.map { it.leaveFromPlaceId.orEmpty() },
            leaveFromPlaceNames = items.map { it.leaveFromPlaceName.orEmpty() },
            leaveByAts = items.map { it.leaveByAt.orEmpty() },
            leaveByStatuses = items.map { it.leaveByStatus.name },
            leaveByReasons = items.map { it.leaveByReason.orEmpty() },
            coveragesJson = items.map { encodeCoverages(it.coverages) },
            uncoveredKidIdsJoined = items.map { it.uncoveredKidIds.joinToString(",") },
            conflictsJson = items.map { encodeConflicts(it.conflicts) },
            rsvpsJson = items.map { encodeRsvps(it.rsvps) },
        )

    private fun itemsFromParallel(
        ids: List<String>,
        sources: List<String>,
        titles: List<String>,
        startsAts: List<String>,
        endsAts: List<String>,
        locations: List<String>,
        kidIdsJoined: List<String>,
        feedIds: List<String>,
        feedNames: List<String>,
        leaveFromPlaceIds: List<String>,
        leaveFromPlaceNames: List<String>,
        leaveByAts: List<String>,
        leaveByStatuses: List<String>,
        leaveByReasons: List<String>,
        coveragesJson: List<String>,
        uncoveredKidIdsJoined: List<String>,
        conflictsJson: List<String>,
        rsvpsJson: List<String>,
    ): List<CalendarItem> =
        ids.indices.map { index ->
            CalendarItem(
                id = ids[index],
                source = CalendarItemSource.valueOf(sources[index]),
                title = titles[index],
                startsAt = startsAts[index],
                endsAt = endsAts[index].ifEmpty { null },
                location = locations[index].ifEmpty { null },
                kidIds =
                    kidIdsJoined[index]
                        .split(",")
                        .map { it.trim() }
                        .filter { it.isNotEmpty() },
                feedId = feedIds[index].ifEmpty { null },
                feedName = feedNames[index].ifEmpty { null },
                leaveFromPlaceId = leaveFromPlaceIds[index].ifEmpty { null },
                leaveFromPlaceName = leaveFromPlaceNames[index].ifEmpty { null },
                leaveByAt = leaveByAts[index].ifEmpty { null },
                leaveByStatus = LeaveByStatus.valueOf(leaveByStatuses[index]),
                leaveByReason = leaveByReasons[index].ifEmpty { null },
                coverages =
                    runCatching {
                        json.decodeFromString(
                            ListSerializer(CalendarCoverageAssignment.serializer()),
                            coveragesJson[index],
                        )
                    }.getOrDefault(emptyList()),
                uncoveredKidIds =
                    uncoveredKidIdsJoined[index]
                        .split(",")
                        .map { it.trim() }
                        .filter { it.isNotEmpty() },
                conflicts =
                    runCatching {
                        json.decodeFromString(
                            ListSerializer(CalendarConflict.serializer()),
                            conflictsJson[index],
                        )
                    }.getOrDefault(emptyList()),
                rsvps =
                    runCatching {
                        json.decodeFromString(
                            ListSerializer(CalendarRsvp.serializer()),
                            rsvpsJson[index],
                        )
                    }.getOrDefault(emptyList()),
            )
        }
}

/** Parallel-array calendar snapshot for Swift SWR paint-from-cache. */
class CalendarCacheBridgeHit(
    val from: String,
    val to: String,
    val fetchedAt: Long,
    val ids: List<String>,
    val sources: List<String>,
    val titles: List<String>,
    val startsAts: List<String>,
    val endsAts: List<String>,
    val locations: List<String>,
    val kidIdsJoined: List<String>,
    val feedIds: List<String>,
    val feedNames: List<String>,
    val leaveFromPlaceIds: List<String>,
    val leaveFromPlaceNames: List<String>,
    val leaveByAts: List<String>,
    val leaveByStatuses: List<String>,
    val leaveByReasons: List<String>,
    val coveragesJson: List<String>,
    val uncoveredKidIdsJoined: List<String>,
    val conflictsJson: List<String>,
    val rsvpsJson: List<String>,
)
