package org.example.project

import kotlinx.serialization.Serializable

@Serializable
enum class FamilyRole {
    ORGANIZER,
    CAREGIVER,
}

@Serializable
data class Kid(
    val id: String,
    val displayName: String,
)

@Serializable
data class Place(
    val id: String,
    val name: String,
    val address: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

fun Place.isLocated(): Boolean = latitude != null && longitude != null

@Serializable
data class ActivityFeed(
    val id: String,
    val name: String,
    val sourceUrl: String,
    val kidIds: List<String> = emptyList(),
    val lastSyncedAt: String? = null,
    val lastSyncError: String? = null,
    val eventCount: Int,
)

fun ActivityFeed.isSynced(): Boolean = lastSyncError.isNullOrBlank() && lastSyncedAt != null

fun ActivityFeed.syncStatusLabel(): String =
    when {
        !lastSyncError.isNullOrBlank() -> "Sync failed: $lastSyncError"
        lastSyncedAt != null -> "Synced · $eventCount events"
        else -> "Not synced"
    }

/** List-row subtitle: optional kid names + sync status (URL stays in edit form only). */
fun ActivityFeed.listStatusLabel(kids: List<Kid>): String {
    val namesById = kids.associateBy({ it.id }, { it.displayName })
    val kidNames =
        kidIds.mapNotNull { id -> namesById[id]?.trim()?.takeIf { it.isNotEmpty() } }
            .joinToString(", ")
    val status = syncStatusLabel()
    return if (kidNames.isEmpty()) status else "$kidNames · $status"
}

@Serializable
data class ManualEvent(
    val id: String,
    val title: String,
    val startsAt: String,
    val endsAt: String? = null,
    val location: String? = null,
    val kidIds: List<String> = emptyList(),
)

@Serializable
enum class CalendarItemSource {
    MANUAL,
    FEED,
}

@Serializable
enum class LeaveByStatus {
    OK,
    UNAVAILABLE,
}

@Serializable
data class CalendarItem(
    val id: String,
    val source: CalendarItemSource,
    val title: String,
    val startsAt: String,
    val endsAt: String? = null,
    val location: String? = null,
    val kidIds: List<String> = emptyList(),
    val feedId: String? = null,
    val feedName: String? = null,
    val leaveFromPlaceId: String? = null,
    val leaveFromPlaceName: String? = null,
    val leaveByAt: String? = null,
    val leaveByStatus: LeaveByStatus = LeaveByStatus.UNAVAILABLE,
    val leaveByReason: String? = null,
)

@Serializable
data class SetCalendarLeaveFromRequest(
    val leaveFromPlaceId: String,
)

@Serializable
data class FamilyMember(
    val adultId: String,
    val email: String,
    val displayName: String? = null,
    val role: FamilyRole,
)

@Serializable
data class FamilyCircle(
    val id: String,
    val name: String? = null,
    val role: FamilyRole,
    val members: List<FamilyMember> = emptyList(),
    val kids: List<Kid> = emptyList(),
    val places: List<Place> = emptyList(),
)

@Serializable
data class FamilyInvite(
    val code: String,
)

@Serializable
data class CreateFamilyCircleRequest(
    val adultDisplayName: String,
    val name: String? = null,
)

@Serializable
data class JoinFamilyCircleRequest(
    val code: String,
    val adultDisplayName: String? = null,
)

@Serializable
data class UpdateFamilyCircleRequest(
    val name: String? = null,
)

@Serializable
data class UpdateFamilyMemberRoleRequest(
    val role: FamilyRole,
)

@Serializable
data class CreateKidRequest(
    val displayName: String,
)

@Serializable
data class UpdateKidRequest(
    val displayName: String,
)

@Serializable
data class CreatePlaceRequest(
    val name: String,
    val address: String,
)

@Serializable
data class UpdatePlaceRequest(
    val name: String,
    val address: String,
)

@Serializable
data class CreateActivityFeedRequest(
    val name: String,
    val sourceUrl: String,
    val kidIds: List<String> = emptyList(),
)

@Serializable
data class UpdateActivityFeedRequest(
    val name: String,
    val sourceUrl: String,
    val kidIds: List<String> = emptyList(),
)

@Serializable
data class CreateManualEventRequest(
    val title: String,
    val startsAt: String,
    val endsAt: String? = null,
    val location: String? = null,
    val kidIds: List<String>,
)

@Serializable
data class UpdateManualEventRequest(
    val title: String,
    val startsAt: String,
    val endsAt: String? = null,
    val location: String? = null,
    val kidIds: List<String>,
)

fun FamilyCircle.displayTitle(): String {
    val trimmed = name?.trim()
    return if (trimmed.isNullOrEmpty()) "Your family" else trimmed
}

fun FamilyMember.displayLabel(): String {
    val trimmed = displayName?.trim()
    return if (trimmed.isNullOrEmpty()) email else trimmed
}
