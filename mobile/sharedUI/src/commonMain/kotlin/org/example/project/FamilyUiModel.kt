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
        return State.Ready(
            email = adult.email,
            adultId = adult.id,
            adultDisplayName = adult.displayName,
            circle = circle,
            inviteCode = inviteCode,
        )
    }
}
