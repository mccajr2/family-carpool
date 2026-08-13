package org.example.project

/**
 * Testable family-circle flow used by Compose [FamilyScreen].
 */
class FamilyUiModel(
    private val session: AuthSession,
    private val familyClient: FamilyClient = FamilyClient.create(),
    private val calendarCache: CalendarCacheStore = InMemoryCalendarCacheStore(),
    private val nowMs: () -> Long = { nowEpochMillis() },
) {
    enum class EmptyMode {
        CHOOSE,
        CREATE,
        JOIN,
    }

    enum class ShellTab {
        CALENDAR,
        CARPOOL,
        FAMILY,
        MORE,
    }

    enum class MoreScreen {
        LIST,
        PLACES,
        FEEDS,
    }

    sealed class State {
        data object Loading : State()

        /**
         * The circle could not be loaded, so whether this adult has one is unknown. Distinct from
         * [NeedsMembership] on purpose: offering "Create family" after a failed load invites a
         * duplicate circle for someone who already has one.
         */
        data class LoadFailed(
            val message: String,
        ) : State()

        data class NeedsMembership(
            val email: String,
            val hasDisplayName: Boolean,
            val mode: EmptyMode = EmptyMode.CHOOSE,
            val adultDisplayName: String = "",
            val circleName: String = "",
            val inviteCodeInput: String = "",
            val loading: Boolean = false,
            val error: String? = null,
        ) : State()

        data class Ready(
            val email: String,
            val adultId: String,
            val adultDisplayName: String?,
            val circle: FamilyCircle,
            val inviteCode: String? = null,
            val newKidName: String = "",
            val editingKidId: String? = null,
            val editingKidName: String = "",
            val newPlaceName: String = "",
            val newPlaceAddress: String = "",
            val editingPlaceId: String? = null,
            val editingPlaceName: String = "",
            val editingPlaceAddress: String = "",
            val feeds: List<ActivityFeed> = emptyList(),
            val newFeedName: String = "",
            val newFeedUrl: String = "",
            val newFeedKidIds: List<String> = emptyList(),
            val editingFeedId: String? = null,
            val editingFeedName: String = "",
            val editingFeedUrl: String = "",
            val editingFeedKidIds: List<String> = emptyList(),
            val calendarItems: List<CalendarItem> = emptyList(),
            val calendarLoadedTo: String = defaultCalendarWindow().to,
            val calendarFetchedAt: Long? = null,
            val calendarRevalidating: Boolean = false,
            val agendaKidFilter: String? = null,
            val newEventTitle: String = "",
            val newEventStartsAt: String = defaultNewEventStartsAtIso(),
            val newEventEndsAt: String = "",
            val newEventLocation: String = "",
            val newEventKidIds: List<String> = emptyList(),
            val editingEventId: String? = null,
            val editingEventTitle: String = "",
            val editingEventStartsAt: String = "",
            val editingEventEndsAt: String = "",
            val editingEventLocation: String = "",
            val editingEventKidIds: List<String> = emptyList(),
            val eventComposeOpen: Boolean = false,
            val shellTab: ShellTab = ShellTab.CALENDAR,
            val moreScreen: MoreScreen = MoreScreen.LIST,
            val loading: Boolean = false,
            val error: String? = null,
            /** Confirm/Assign failures keyed by `source-id` — shown on the item CTAs. */
            val coverageActionErrors: Map<String, String> = emptyMap(),
        ) : State()
    }

    /**
     * Invoked after every [_state] assignment so Compose can show mid-request busy
     * (e.g. Load more → Loading…) — [FamilyScreen] only mirrored state after await.
     */
    var stateListener: (() -> Unit)? = null

    private var _state: State = State.Loading
        set(value) {
            field = value
            stateListener?.invoke()
        }

    val state: State
        get() = _state

    suspend fun load() {
        _state = State.Loading
        try {
            val adult = session.currentAdult()
            val token = session.requireAccessToken()
            val circle = familyClient.getCircle(token)
            _state =
                if (circle == null) {
                    State.NeedsMembership(
                        email = adult.email,
                        hasDisplayName = !adult.displayName.isNullOrBlank(),
                    )
                } else {
                    readyState(adult, circle, token)
                }
        } catch (e: Throwable) {
            _state = State.LoadFailed(message = e.message ?: "Failed to load family")
        }
    }

    fun showCreate() {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(mode = EmptyMode.CREATE, error = null)
    }

    fun showJoin() {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(mode = EmptyMode.JOIN, error = null)
    }

    fun showChoose() {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(mode = EmptyMode.CHOOSE, error = null)
    }

    fun updateAdultDisplayName(value: String) {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(adultDisplayName = value, error = null)
    }

    fun updateCircleName(value: String) {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(circleName = value, error = null)
    }

    fun updateInviteCodeInput(value: String) {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(inviteCodeInput = value, error = null)
    }

    fun selectShellTab(tab: ShellTab) {
        val current = _state as? State.Ready ?: return
        val leavingCalendar = current.shellTab == ShellTab.CALENDAR && tab != ShellTab.CALENDAR
        _state =
            if (leavingCalendar) {
                current.withEventComposeClosed().copy(
                    shellTab = tab,
                    moreScreen = MoreScreen.LIST,
                    error = null,
                )
            } else {
                current.copy(
                    shellTab = tab,
                    moreScreen = MoreScreen.LIST,
                    error = null,
                )
            }
    }

    /** Clear persisted calendar snapshots (call on sign-out). */
    fun clearCalendarCache() {
        calendarCache.clearAll()
    }

    /**
     * Soft-TTL revalidate when Calendar becomes visible again. No-op when fresh or already
     * revalidating.
     */
    suspend fun revalidateCalendarIfStale() {
        val current = _state as? State.Ready ?: return
        if (current.shellTab != ShellTab.CALENDAR) return
        val fetchedAt = current.calendarFetchedAt ?: return
        if (!calendarCache.isStale(fetchedAt, nowMs())) return
        if (current.calendarRevalidating) return
        revalidateCalendar(current, force = true)
    }

    fun openMorePlaces() {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                shellTab = ShellTab.MORE,
                moreScreen = MoreScreen.PLACES,
                error = null,
            )
    }

    fun openMoreFeeds() {
        val current = _state as? State.Ready ?: return
        if (!AppShell.showsFeedsRow(current.circle.role == FamilyRole.ORGANIZER)) {
            return
        }
        _state =
            current.copy(
                shellTab = ShellTab.MORE,
                moreScreen = MoreScreen.FEEDS,
                error = null,
            )
    }

    fun openMoreList() {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                shellTab = ShellTab.MORE,
                moreScreen = MoreScreen.LIST,
                error = null,
            )
    }

    fun updateNewKidName(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newKidName = value, error = null)
    }

    fun beginRename(kid: Kid) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingKidId = kid.id,
                editingKidName = kid.displayName,
                error = null,
            )
    }

    fun updateEditingKidName(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingKidName = value, error = null)
    }

    fun cancelRename() {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingKidId = null, editingKidName = "", error = null)
    }

    fun updateNewPlaceName(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newPlaceName = value, error = null)
    }

    fun updateNewPlaceAddress(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newPlaceAddress = value, error = null)
    }

    fun beginEditPlace(place: Place) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingPlaceId = place.id,
                editingPlaceName = place.name,
                editingPlaceAddress = place.address,
                error = null,
            )
    }

    fun updateEditingPlaceName(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingPlaceName = value, error = null)
    }

    fun updateEditingPlaceAddress(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingPlaceAddress = value, error = null)
    }

    fun cancelEditPlace() {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingPlaceId = null,
                editingPlaceName = "",
                editingPlaceAddress = "",
                error = null,
            )
    }

    fun updateNewFeedName(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newFeedName = value, error = null)
    }

    fun updateNewFeedUrl(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newFeedUrl = value, error = null)
    }

    fun toggleNewFeedKid(kidId: String) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                newFeedKidIds =
                    current.newFeedKidIds.toggle(kidId),
                error = null,
            )
    }

    fun beginEditFeed(feed: ActivityFeed) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingFeedId = feed.id,
                editingFeedName = feed.name,
                editingFeedUrl = feed.sourceUrl,
                editingFeedKidIds = feed.kidIds,
                error = null,
            )
    }

    fun updateEditingFeedName(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingFeedName = value, error = null)
    }

    fun updateEditingFeedUrl(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingFeedUrl = value, error = null)
    }

    fun toggleEditingFeedKid(kidId: String) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingFeedKidIds =
                    current.editingFeedKidIds.toggle(kidId),
                error = null,
            )
    }

    fun cancelEditFeed() {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingFeedId = null,
                editingFeedName = "",
                editingFeedUrl = "",
                editingFeedKidIds = emptyList(),
                error = null,
            )
    }

    fun updateNewEventTitle(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newEventTitle = value, error = null)
    }

    fun updateNewEventStartsAt(value: String) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                newEventStartsAt = value,
                newEventEndsAt = coerceEndsAt(value, current.newEventEndsAt),
                error = null,
            )
    }

    fun updateNewEventEndsAt(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newEventEndsAt = value, error = null)
    }

    fun updateNewEventLocation(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(newEventLocation = value, error = null)
    }

    fun toggleNewEventKid(kidId: String) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                newEventKidIds = current.newEventKidIds.toggle(kidId),
                error = null,
            )
    }

    fun setAgendaKidFilter(kidId: String?) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(agendaKidFilter = kidId, error = null)
    }

    fun openCreateEventCompose() {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                eventComposeOpen = true,
                editingEventId = null,
                editingEventTitle = "",
                editingEventStartsAt = "",
                editingEventEndsAt = "",
                editingEventLocation = "",
                editingEventKidIds = emptyList(),
                error = null,
            )
    }

    fun closeEventCompose() {
        val current = _state as? State.Ready ?: return
        _state = current.withEventComposeClosed()
    }

    fun beginEditEvent(item: CalendarItem) {
        if (item.source != CalendarItemSource.MANUAL) return
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                eventComposeOpen = true,
                editingEventId = item.id,
                editingEventTitle = item.title,
                editingEventStartsAt = item.startsAt,
                editingEventEndsAt = item.endsAt.orEmpty(),
                editingEventLocation = item.location.orEmpty(),
                editingEventKidIds = item.kidIds,
                error = null,
            )
    }

    fun updateEditingEventTitle(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingEventTitle = value, error = null)
    }

    fun updateEditingEventStartsAt(value: String) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingEventStartsAt = value,
                editingEventEndsAt = coerceEndsAt(value, current.editingEventEndsAt),
                error = null,
            )
    }

    fun updateEditingEventEndsAt(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingEventEndsAt = value, error = null)
    }

    fun updateEditingEventLocation(value: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(editingEventLocation = value, error = null)
    }

    fun toggleEditingEventKid(kidId: String) {
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingEventKidIds = current.editingEventKidIds.toggle(kidId),
                error = null,
            )
    }

    fun cancelEditEvent() {
        closeEventCompose()
    }

    suspend fun createCircle() {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val name = current.circleName.trim().ifEmpty { null }
            val circle =
                familyClient.createCircle(
                    accessToken = token,
                    adultDisplayName = current.adultDisplayName.trim(),
                    name = name,
                )
            val adult = session.currentAdult()
            _state = readyState(adult, circle, token)
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Create failed",
                )
        }
    }

    suspend fun joinCircle() {
        val current = _state as? State.NeedsMembership ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val displayName =
                current.adultDisplayName.trim().ifEmpty { null }
            val circle =
                familyClient.joinCircle(
                    accessToken = token,
                    code = current.inviteCodeInput.trim(),
                    adultDisplayName = displayName,
                )
            val adult = session.currentAdult()
            _state = readyState(adult, circle, token)
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Join failed",
                )
        }
    }

    suspend fun regenerateInvite() {
        val current = _state as? State.Ready ?: return
        if (current.circle.role != FamilyRole.ORGANIZER) return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val invite = familyClient.regenerateInvite(token)
            _state = current.copy(loading = false, inviteCode = invite.code)
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Regenerate failed",
                )
        }
    }

    suspend fun leaveCircle() {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            familyClient.leaveCircle(token)
            calendarCache.clear(current.adultId, current.circle.id)
            val adult = session.currentAdult()
            _state =
                State.NeedsMembership(
                    email = adult.email,
                    hasDisplayName = !adult.displayName.isNullOrBlank(),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Leave failed",
                )
        }
    }

    suspend fun updateMemberRole(
        adultId: String,
        role: FamilyRole,
    ) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val circle = familyClient.updateMemberRole(token, adultId, role)
            _state = current.copy(loading = false, circle = circle)
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Update role failed",
                )
        }
    }

    suspend fun removeMember(adultId: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            familyClient.removeMember(token, adultId)
            _state =
                current.copy(
                    loading = false,
                    circle =
                        current.circle.copy(
                            members = current.circle.members.filterNot { it.adultId == adultId },
                        ),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Remove member failed",
                )
        }
    }

    suspend fun addKid() {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val kid = familyClient.addKid(token, current.newKidName.trim())
            _state =
                current.copy(
                    loading = false,
                    newKidName = "",
                    circle = current.circle.copy(kids = current.circle.kids + kid),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Add kid failed",
                )
        }
    }

    suspend fun saveRename() {
        val current = _state as? State.Ready ?: return
        val kidId = current.editingKidId ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated = familyClient.updateKid(token, kidId, current.editingKidName.trim())
            _state =
                current.copy(
                    loading = false,
                    editingKidId = null,
                    editingKidName = "",
                    circle =
                        current.circle.copy(
                            kids =
                                current.circle.kids.map { kid ->
                                    if (kid.id == kidId) updated else kid
                                },
                        ),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Rename failed",
                )
        }
    }

    suspend fun removeKid(kidId: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            familyClient.deleteKid(token, kidId)
            _state =
                current.copy(
                    loading = false,
                    circle =
                        current.circle.copy(
                            kids = current.circle.kids.filterNot { it.id == kidId },
                        ),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Remove failed",
                )
        }
    }

    suspend fun addPlace() {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val place =
                familyClient.addPlace(
                    token,
                    current.newPlaceName.trim(),
                    current.newPlaceAddress.trim(),
                )
            _state =
                current.copy(
                    loading = false,
                    newPlaceName = "",
                    newPlaceAddress = "",
                    circle = current.circle.copy(places = current.circle.places + place),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Add place failed",
                )
        }
    }

    suspend fun savePlace() {
        val current = _state as? State.Ready ?: return
        val placeId = current.editingPlaceId ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated =
                familyClient.updatePlace(
                    token,
                    placeId,
                    current.editingPlaceName.trim(),
                    current.editingPlaceAddress.trim(),
                )
            _state =
                current.copy(
                    loading = false,
                    editingPlaceId = null,
                    editingPlaceName = "",
                    editingPlaceAddress = "",
                    circle =
                        current.circle.copy(
                            places =
                                current.circle.places.map { place ->
                                    if (place.id == placeId) updated else place
                                },
                        ),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Update place failed",
                )
        }
    }

    suspend fun removePlace(placeId: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            familyClient.deletePlace(token, placeId)
            _state =
                current.copy(
                    loading = false,
                    circle =
                        current.circle.copy(
                            places = current.circle.places.filterNot { it.id == placeId },
                        ),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Remove place failed",
                )
        }
    }

    suspend fun locatePlace(placeId: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated = familyClient.locatePlace(token, placeId)
            _state =
                current.copy(
                    loading = false,
                    circle =
                        current.circle.copy(
                            places =
                                current.circle.places.map { place ->
                                    if (place.id == placeId) updated else place
                                },
                        ),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Locate place failed",
                )
        }
    }

    suspend fun addFeed() {
        val current = _state as? State.Ready ?: return
        if (current.circle.role != FamilyRole.ORGANIZER) return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val feed =
                familyClient.createFeed(
                    token,
                    current.newFeedName.trim(),
                    current.newFeedUrl.trim(),
                    current.newFeedKidIds,
                )
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, current.calendarLoadedTo)
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds + feed,
                    newFeedName = "",
                    newFeedUrl = "",
                    newFeedKidIds = emptyList(),
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                )
        } catch (e: Throwable) {
            _state = current.copy(loading = false, error = e.message ?: "Add feed failed")
        }
    }

    suspend fun saveFeed() {
        val current = _state as? State.Ready ?: return
        if (current.circle.role != FamilyRole.ORGANIZER) return
        val feedId = current.editingFeedId ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated =
                familyClient.updateFeed(
                    token,
                    feedId,
                    current.editingFeedName.trim(),
                    current.editingFeedUrl.trim(),
                    current.editingFeedKidIds,
                )
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, current.calendarLoadedTo)
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds.map { if (it.id == feedId) updated else it },
                    editingFeedId = null,
                    editingFeedName = "",
                    editingFeedUrl = "",
                    editingFeedKidIds = emptyList(),
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                )
        } catch (e: Throwable) {
            _state = current.copy(loading = false, error = e.message ?: "Update feed failed")
        }
    }

    suspend fun removeFeed(feedId: String) {
        val current = _state as? State.Ready ?: return
        if (current.circle.role != FamilyRole.ORGANIZER) return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            familyClient.deleteFeed(token, feedId)
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, current.calendarLoadedTo)
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds.filterNot { it.id == feedId },
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                )
        } catch (e: Throwable) {
            _state = current.copy(loading = false, error = e.message ?: "Remove feed failed")
        }
    }

    suspend fun syncFeed(feedId: String) {
        val current = _state as? State.Ready ?: return
        if (current.circle.role != FamilyRole.ORGANIZER) return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated = familyClient.syncFeed(token, feedId)
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, current.calendarLoadedTo)
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds.map { if (it.id == feedId) updated else it },
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                )
        } catch (e: Throwable) {
            _state = current.copy(loading = false, error = e.message ?: "Sync feed failed")
        }
    }

    /** Re-GET feeds list only — does not trigger Sync now. */
    suspend fun refreshFeeds() {
        val current = _state as? State.Ready ?: return
        if (current.circle.role != FamilyRole.ORGANIZER) return
        _state = current.copy(loading = true, error = null)
        try {
            val feeds = familyClient.listFeeds(session.requireAccessToken())
            _state = current.copy(loading = false, feeds = feeds)
        } catch (e: Throwable) {
            _state = current.copy(loading = false, error = e.message ?: "Refresh feeds failed")
        }
    }

    suspend fun loadMoreCalendar() {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val page = advanceCalendarWindow(current.calendarLoadedTo)
            val more = familyClient.listCalendar(token, page.from, page.to)
            val merged = mergeCalendarItems(current.calendarItems, more)
            val fetchedAt = persistCalendarSnapshot(current.adultId, current.circle.id, page.to, merged)
            _state =
                current.copy(
                    loading = false,
                    calendarItems = merged,
                    calendarLoadedTo = page.to,
                    calendarFetchedAt = fetchedAt,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Load more failed",
                )
        }
    }

    suspend fun addEvent() {
        val current = _state as? State.Ready ?: return
        val validation =
            validateManualEventTimes(current.newEventStartsAt, current.newEventEndsAt)
        if (validation != null) {
            _state = current.copy(error = validation)
            return
        }
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val startsAt = current.newEventStartsAt.trim()
            val endsAt = current.newEventEndsAt.trim().ifEmpty { null }
            val location = current.newEventLocation.trim().ifEmpty { null }
            familyClient.createEvent(
                token,
                current.newEventTitle.trim(),
                startsAt,
                current.newEventKidIds,
                endsAt,
                location,
            )
            val loadedTo = ensureCalendarWindowCovers(current.calendarLoadedTo, startsAt)
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, loadedTo)
            _state =
                current.copy(
                    loading = false,
                    eventComposeOpen = false,
                    newEventTitle = "",
                    newEventStartsAt = defaultNewEventStartsAtIso(),
                    newEventEndsAt = "",
                    newEventLocation = "",
                    newEventKidIds = emptyList(),
                    calendarLoadedTo = loadedTo,
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                    error = null,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Add event failed",
                )
        }
    }

    suspend fun saveEvent() {
        val current = _state as? State.Ready ?: return
        val eventId = current.editingEventId ?: return
        val validation =
            validateManualEventTimes(current.editingEventStartsAt, current.editingEventEndsAt)
        if (validation != null) {
            _state = current.copy(error = validation)
            return
        }
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val startsAt = current.editingEventStartsAt.trim()
            val endsAt = current.editingEventEndsAt.trim().ifEmpty { null }
            val location = current.editingEventLocation.trim().ifEmpty { null }
            familyClient.updateEvent(
                token,
                eventId,
                current.editingEventTitle.trim(),
                startsAt,
                current.editingEventKidIds,
                endsAt,
                location,
            )
            val loadedTo = ensureCalendarWindowCovers(current.calendarLoadedTo, startsAt)
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, loadedTo)
            _state =
                current.copy(
                    loading = false,
                    eventComposeOpen = false,
                    editingEventId = null,
                    editingEventTitle = "",
                    editingEventStartsAt = "",
                    editingEventEndsAt = "",
                    editingEventLocation = "",
                    editingEventKidIds = emptyList(),
                    calendarLoadedTo = loadedTo,
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                    error = null,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Update event failed",
                )
        }
    }

    suspend fun removeEvent(eventId: String) {
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            familyClient.deleteEvent(token, eventId)
            val (calendarItems, calendarFetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, current.calendarLoadedTo)
            _state =
                current.copy(
                    loading = false,
                    calendarItems = calendarItems,
                    calendarFetchedAt = calendarFetchedAt,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Remove event failed",
                )
        }
    }

    suspend fun setCalendarLeaveFrom(
        item: CalendarItem,
        placeId: String,
    ) {
        if (item.leaveFromPlaceId == placeId) return
        val current = _state as? State.Ready ?: return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated =
                familyClient.setCalendarLeaveFrom(
                    token,
                    item.source,
                    item.id,
                    SetCalendarLeaveFromRequest(leaveFromPlaceId = placeId),
                )
            _state =
                current.copy(
                    loading = false,
                    calendarItems = applyPatchedCalendarItem(current, updated),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Set leave-from failed",
                )
        }
    }

    suspend fun setDefaultLeaveFrom(placeId: String?) {
        val current = _state as? State.Ready ?: return
        if (current.circle.defaultLeaveFromPlaceId == placeId) return
        _state = current.copy(loading = true, error = null)
        try {
            val token = session.requireAccessToken()
            val updated =
                familyClient.setDefaultLeaveFrom(
                    token,
                    SetDefaultLeaveFromRequest(placeId = placeId),
                )
            _state = current.copy(loading = false, circle = updated)
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Set default leave-from failed",
                )
        }
    }

    suspend fun assignCoverage(
        item: CalendarItem,
        coveringAdultId: String,
        kidIds: List<String>,
    ) {
        val current = _state as? State.Ready ?: return
        val itemKey = agendaCoverageItemKey(item)
        _state =
            current.copy(
                loading = true,
                error = null,
                coverageActionErrors = current.coverageActionErrors - itemKey,
            )
        try {
            val token = session.requireAccessToken()
            val updated =
                familyClient.assignCalendarCoverage(
                    token,
                    item.source,
                    item.id,
                    AssignCalendarCoverageRequest(
                        coveringAdultId = coveringAdultId,
                        kidIds = kidIds,
                    ),
                )
            _state =
                current.copy(
                    loading = false,
                    calendarItems = applyPatchedCalendarItem(current, updated),
                    coverageActionErrors = current.coverageActionErrors - itemKey,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    coverageActionErrors =
                        current.coverageActionErrors +
                            (
                                itemKey to
                                    coverageDoubleBookMessage(
                                        e.message ?: "Assign coverage failed",
                                    )
                            ),
                )
        }
    }

    suspend fun confirmCoverage(assignmentId: String) {
        updateCalendarItemFromCoverageAction(
            assignmentId,
            "Confirm coverage failed",
            mapDoubleBook = true,
        ) { token, id ->
            familyClient.confirmCalendarCoverage(token, id)
        }
    }

    suspend fun declineCoverage(assignmentId: String) {
        updateCalendarItemFromCoverageAction(assignmentId, "Decline coverage failed") { token, id ->
            familyClient.declineCalendarCoverage(token, id)
        }
    }

    suspend fun removeCoverage(assignmentId: String) {
        updateCalendarItemFromCoverageAction(assignmentId, "Remove coverage failed") { token, id ->
            familyClient.removeCalendarCoverage(token, id)
        }
    }

    private suspend fun updateCalendarItemFromCoverageAction(
        assignmentId: String,
        failureMessage: String,
        mapDoubleBook: Boolean = false,
        action: suspend (token: String, assignmentId: String) -> CalendarItem,
    ) {
        val current = _state as? State.Ready ?: return
        val itemKey =
            current.calendarItems
                .firstOrNull { item -> item.coverages.any { it.id == assignmentId } }
                ?.let { agendaCoverageItemKey(it) }
        _state =
            current.copy(
                loading = true,
                error = null,
                coverageActionErrors =
                    if (itemKey != null) {
                        current.coverageActionErrors - itemKey
                    } else {
                        current.coverageActionErrors
                    },
            )
        try {
            val token = session.requireAccessToken()
            val updated = action(token, assignmentId)
            _state =
                current.copy(
                    loading = false,
                    calendarItems = applyPatchedCalendarItem(current, updated),
                    coverageActionErrors =
                        if (itemKey != null) {
                            current.coverageActionErrors - itemKey
                        } else {
                            current.coverageActionErrors
                        },
                )
        } catch (e: Throwable) {
            val message =
                if (mapDoubleBook) {
                    coverageDoubleBookMessage(e.message ?: failureMessage)
                } else {
                    e.message ?: failureMessage
                }
            _state =
                if (itemKey != null && mapDoubleBook) {
                    current.copy(
                        loading = false,
                        coverageActionErrors = current.coverageActionErrors + (itemKey to message),
                    )
                } else {
                    current.copy(loading = false, error = message)
                }
        }
    }

    private fun replaceCalendarItem(
        items: List<CalendarItem>,
        updated: CalendarItem,
    ): List<CalendarItem> =
        items.map { row ->
            if (row.source == updated.source && row.id == updated.id) updated else row
        }

    private fun applyPatchedCalendarItem(
        current: State.Ready,
        updated: CalendarItem,
    ): List<CalendarItem> {
        calendarCache.patchItem(current.adultId, current.circle.id, updated)
        return replaceCalendarItem(current.calendarItems, updated)
    }

    private fun persistCalendarSnapshot(
        adultId: String,
        circleId: String,
        loadedTo: String,
        items: List<CalendarItem>,
        fetchedAt: Long = nowMs(),
    ): Long {
        val window = calendarWindowThrough(loadedTo)
        calendarCache.save(
            CalendarCacheSnapshot(
                adultId = adultId,
                circleId = circleId,
                from = window.from,
                to = window.to,
                items = items,
                fetchedAt = fetchedAt,
            ),
        )
        return fetchedAt
    }

    private suspend fun loadCalendarItems(
        token: String,
        loadedTo: String = defaultCalendarWindow().to,
    ): List<CalendarItem> {
        val window = calendarWindowThrough(loadedTo)
        return familyClient.listCalendar(token, window.from, window.to)
    }

    private suspend fun loadAndPersistCalendarItems(
        token: String,
        adultId: String,
        circleId: String,
        loadedTo: String,
    ): Pair<List<CalendarItem>, Long> {
        val items = loadCalendarItems(token, loadedTo)
        val fetchedAt = persistCalendarSnapshot(adultId, circleId, loadedTo, items)
        return items to fetchedAt
    }

    private suspend fun revalidateCalendar(
        current: State.Ready,
        force: Boolean,
    ) {
        if (!force) {
            val fetchedAt = current.calendarFetchedAt ?: return
            if (!calendarCache.isStale(fetchedAt, nowMs())) return
        }
        _state = current.copy(calendarRevalidating = true, error = null)
        try {
            val token = session.requireAccessToken()
            val today = defaultCalendarWindow()
            val to = maxIsoInstant(today.to, current.calendarLoadedTo)
            val (items, fetchedAt) =
                loadAndPersistCalendarItems(token, current.adultId, current.circle.id, to)
            val latest = _state as? State.Ready ?: return
            _state =
                latest.copy(
                    calendarItems = items,
                    calendarLoadedTo = to,
                    calendarFetchedAt = fetchedAt,
                    calendarRevalidating = false,
                    error = null,
                )
        } catch (e: Throwable) {
            val latest = _state as? State.Ready ?: return
            _state =
                latest.copy(
                    calendarRevalidating = false,
                    error =
                        if (latest.calendarItems.isNotEmpty()) {
                            e.message ?: "Calendar refresh failed"
                        } else {
                            e.message ?: "Calendar refresh failed"
                        },
                )
        }
    }

    private suspend fun readyState(
        adult: Adult,
        circle: FamilyCircle,
        token: String,
    ): State.Ready {
        val inviteCode =
            if (circle.role == FamilyRole.ORGANIZER) {
                runCatching { familyClient.getInvite(token).code }.getOrNull()
            } else {
                null
            }
        val feeds =
            if (circle.role == FamilyRole.ORGANIZER) {
                runCatching { familyClient.listFeeds(token) }.getOrElse { emptyList() }
            } else {
                emptyList()
            }
        val cached = calendarCache.load(adult.id, circle.id)
        if (cached != null) {
            _state =
                State.Ready(
                    email = adult.email,
                    adultId = adult.id,
                    adultDisplayName = adult.displayName,
                    circle = circle,
                    inviteCode = inviteCode,
                    feeds = feeds,
                    calendarItems = cached.items,
                    calendarLoadedTo = cached.to,
                    calendarFetchedAt = cached.fetchedAt,
                    calendarRevalidating = true,
                )
        }
        val today = defaultCalendarWindow()
        val to = if (cached != null) maxIsoInstant(today.to, cached.to) else today.to
        val calendarResult =
            runCatching { loadAndPersistCalendarItems(token, adult.id, circle.id, to) }
        val items: List<CalendarItem>
        val fetchedAt: Long?
        if (calendarResult.isSuccess) {
            val pair = calendarResult.getOrThrow()
            items = pair.first
            fetchedAt = pair.second
        } else if (cached != null) {
            items = cached.items
            fetchedAt = cached.fetchedAt
        } else {
            items = emptyList()
            fetchedAt = null
        }
        return State.Ready(
            email = adult.email,
            adultId = adult.id,
            adultDisplayName = adult.displayName,
            circle = circle,
            inviteCode = inviteCode,
            feeds = feeds,
            calendarItems = items,
            calendarLoadedTo = if (calendarResult.isSuccess || cached != null) to else today.to,
            calendarFetchedAt = fetchedAt,
            calendarRevalidating = false,
            error =
                if (calendarResult.isFailure) {
                    calendarResult.exceptionOrNull()?.message
                } else {
                    null
                },
        )
    }
}

private fun FamilyUiModel.State.Ready.withEventComposeClosed(): FamilyUiModel.State.Ready =
    copy(
        eventComposeOpen = false,
        newEventTitle = "",
        newEventStartsAt = defaultNewEventStartsAtIso(),
        newEventEndsAt = "",
        newEventLocation = "",
        newEventKidIds = emptyList(),
        editingEventId = null,
        editingEventTitle = "",
        editingEventStartsAt = "",
        editingEventEndsAt = "",
        editingEventLocation = "",
        editingEventKidIds = emptyList(),
        error = null,
    )

internal fun agendaCoverageItemKey(item: CalendarItem): String = "${item.source.name}-${item.id}"

/** Clear ends when it would be before the new start (client ordering rule). */
private fun coerceEndsAt(
    startsAtIso: String,
    endsAtIso: String,
): String {
    val starts = parseIsoToEpochMillis(startsAtIso) ?: return endsAtIso
    val ends = parseIsoToEpochMillis(endsAtIso) ?: return endsAtIso
    return if (ends < starts) "" else endsAtIso
}

private fun List<String>.toggle(value: String): List<String> =
    if (value in this) filterNot { it == value } else this + value
