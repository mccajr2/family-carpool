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
data class FamilyCircle(
    val id: String,
    val name: String? = null,
    val role: FamilyRole,
    val kids: List<Kid> = emptyList(),
)

@Serializable
data class CreateFamilyCircleRequest(
    val adultDisplayName: String,
    val name: String? = null,
)

@Serializable
data class UpdateFamilyCircleRequest(
    val name: String? = null,
)

@Serializable
data class CreateKidRequest(
    val displayName: String,
)

@Serializable
data class UpdateKidRequest(
    val displayName: String,
)

fun FamilyCircle.displayTitle(): String {
    val trimmed = name?.trim()
    return if (trimmed.isNullOrEmpty()) "Your family" else trimmed
}
