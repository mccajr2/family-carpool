package org.example.project

/**
 * Testable family-circle flow used by Compose [FamilyScreen].
 */
class FamilyUiModel(
    private val session: AuthSession,
    private val familyClient: FamilyClient = FamilyClient.create(),
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
            val shellTab: ShellTab = ShellTab.CALENDAR,
            val moreScreen: MoreScreen = MoreScreen.LIST,
            val loading: Boolean = false,
            val error: String? = null,
        ) : State()
    }

    private var _state: State = State.Loading

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
            _state =
                State.NeedsMembership(
                    email = "",
                    hasDisplayName = false,
                    error = e.message ?: "Failed to load family",
                )
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
        _state =
            current.copy(
                shellTab = tab,
                moreScreen = MoreScreen.LIST,
                error = null,
            )
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
        if (current.circle.role != FamilyRole.ORGANIZER) {
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

    fun beginEditEvent(item: CalendarItem) {
        if (item.source != CalendarItemSource.MANUAL) return
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
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
        val current = _state as? State.Ready ?: return
        _state =
            current.copy(
                editingEventId = null,
                editingEventTitle = "",
                editingEventStartsAt = "",
                editingEventEndsAt = "",
                editingEventLocation = "",
                editingEventKidIds = emptyList(),
                error = null,
            )
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
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds + feed,
                    newFeedName = "",
                    newFeedUrl = "",
                    newFeedKidIds = emptyList(),
                    calendarItems = loadCalendarItems(token, current.calendarLoadedTo),
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
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds.map { if (it.id == feedId) updated else it },
                    editingFeedId = null,
                    editingFeedName = "",
                    editingFeedUrl = "",
                    editingFeedKidIds = emptyList(),
                    calendarItems = loadCalendarItems(token, current.calendarLoadedTo),
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
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds.filterNot { it.id == feedId },
                    calendarItems = loadCalendarItems(token, current.calendarLoadedTo),
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
            _state =
                current.copy(
                    loading = false,
                    feeds = current.feeds.map { if (it.id == feedId) updated else it },
                    calendarItems = loadCalendarItems(token, current.calendarLoadedTo),
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
            val more =
                runCatching {
                    familyClient.listCalendar(token, page.from, page.to)
                }.getOrElse { emptyList() }
            _state =
                current.copy(
                    loading = false,
                    calendarItems = mergeCalendarItems(current.calendarItems, more),
                    calendarLoadedTo = page.to,
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
            _state =
                current.copy(
                    loading = false,
                    newEventTitle = "",
                    newEventStartsAt = defaultNewEventStartsAtIso(),
                    newEventEndsAt = "",
                    newEventLocation = "",
                    newEventKidIds = emptyList(),
                    calendarLoadedTo = loadedTo,
                    calendarItems = loadCalendarItems(token, loadedTo),
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
            _state =
                current.copy(
                    loading = false,
                    editingEventId = null,
                    editingEventTitle = "",
                    editingEventStartsAt = "",
                    editingEventEndsAt = "",
                    editingEventLocation = "",
                    editingEventKidIds = emptyList(),
                    calendarLoadedTo = loadedTo,
                    calendarItems = loadCalendarItems(token, loadedTo),
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
            _state =
                current.copy(
                    loading = false,
                    calendarItems = loadCalendarItems(token, current.calendarLoadedTo),
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Remove event failed",
                )
        }
    }

    private suspend fun loadCalendarItems(
        token: String,
        loadedTo: String = defaultCalendarWindow().to,
    ): List<CalendarItem> {
        val window = calendarWindowThrough(loadedTo)
        return runCatching {
            familyClient.listCalendar(token, window.from, window.to)
        }.getOrElse { emptyList() }
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
        val initialWindow = defaultCalendarWindow()
        return State.Ready(
            email = adult.email,
            adultId = adult.id,
            adultDisplayName = adult.displayName,
            circle = circle,
            inviteCode = inviteCode,
            feeds = feeds,
            calendarItems = loadCalendarItems(token, initialWindow.to),
            calendarLoadedTo = initialWindow.to,
        )
    }
}

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
