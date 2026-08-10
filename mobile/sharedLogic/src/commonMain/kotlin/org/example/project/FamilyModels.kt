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

fun FamilyCircle.displayTitle(): String {
    val trimmed = name?.trim()
    return if (trimmed.isNullOrEmpty()) "Your family" else trimmed
}

fun FamilyMember.displayLabel(): String {
    val trimmed = displayName?.trim()
    return if (trimmed.isNullOrEmpty()) email else trimmed
}
