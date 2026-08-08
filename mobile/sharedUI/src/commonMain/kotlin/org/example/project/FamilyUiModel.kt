package org.example.project

/**
 * Testable family-circle flow used by Compose [FamilyScreen].
 */
class FamilyUiModel(
    private val session: AuthSession,
    private val familyClient: FamilyClient = FamilyClient.create(),
) {
    sealed class State {
        data object Loading : State()

        data class NeedsCreate(
            val email: String,
            val adultDisplayName: String = "",
            val circleName: String = "",
            val loading: Boolean = false,
            val error: String? = null,
        ) : State()

        data class Ready(
            val email: String,
            val adultDisplayName: String?,
            val circle: FamilyCircle,
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
                    State.NeedsCreate(email = adult.email)
                } else {
                    State.Ready(
                        email = adult.email,
                        adultDisplayName = adult.displayName,
                        circle = circle,
                    )
                }
        } catch (e: Throwable) {
            _state =
                State.NeedsCreate(
                    email = "",
                    error = e.message ?: "Failed to load family",
                )
        }
    }

    fun updateAdultDisplayName(value: String) {
        val current = _state as? State.NeedsCreate ?: return
        _state = current.copy(adultDisplayName = value, error = null)
    }

    fun updateCircleName(value: String) {
        val current = _state as? State.NeedsCreate ?: return
        _state = current.copy(circleName = value, error = null)
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
        val current = _state as? State.NeedsCreate ?: return
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
            _state =
                State.Ready(
                    email = adult.email,
                    adultDisplayName = adult.displayName,
                    circle = circle,
                )
        } catch (e: Throwable) {
            _state =
                current.copy(
                    loading = false,
                    error = e.message ?: "Create failed",
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
}
