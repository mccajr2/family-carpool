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

fun FamilyCircle.displayTitle(): String {
    val trimmed = name?.trim()
    return if (trimmed.isNullOrEmpty()) "Your family" else trimmed
}

fun FamilyMember.displayLabel(): String {
    val trimmed = displayName?.trim()
    return if (trimmed.isNullOrEmpty()) email else trimmed
}
