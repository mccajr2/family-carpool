package org.example.project

import kotlinx.serialization.Serializable

@Serializable
enum class CarpoolSpaceMembership {
    OWNER,
    MEMBER,
}

@Serializable
enum class CarpoolFeedStatusKind {
    NONE,
    AVAILABLE,
    REQUESTED,
    MEMBER,
    OWNER,
}

@Serializable
data class CarpoolFeedStatus(
    val feedId: String,
    val feedName: String,
    val status: CarpoolFeedStatusKind,
    val spaceId: String? = null,
    val spaceName: String? = null,
)

@Serializable
data class CarpoolSpaceMember(
    val circleId: String,
    val circleName: String? = null,
    val membership: CarpoolSpaceMembership,
)

@Serializable
data class CarpoolJoinRequest(
    val id: String,
    val spaceId: String,
    val circleId: String,
    val circleName: String? = null,
    val requestedByAdultId: String,
    val requestedByDisplayName: String? = null,
)

@Serializable
data class CarpoolInvite(
    val code: String,
)

@Serializable
data class CarpoolSpace(
    val id: String,
    val name: String,
    val membership: CarpoolSpaceMembership,
    val inviteCode: String,
    val callerFeedId: String? = null,
    val members: List<CarpoolSpaceMember> = emptyList(),
    val pendingRequests: List<CarpoolJoinRequest> = emptyList(),
)

@Serializable
data class CarpoolSummary(
    val circleRole: FamilyRole,
    val feeds: List<CarpoolFeedStatus> = emptyList(),
    val spaces: List<CarpoolSpace> = emptyList(),
)

@Serializable
enum class CarpoolRideStatus {
    PENDING,
    ACCEPTED,
    CANCELLED,
}

@Serializable
data class CarpoolRide(
    val id: String,
    val spaceId: String,
    val eventKey: String,
    val requestingCircleId: String,
    val requestingCircleName: String? = null,
    val requestedByAdultId: String,
    val kidIds: List<String> = emptyList(),
    val kidFirstNames: List<String> = emptyList(),
    val seats: Int,
    val pickupPlaceName: String,
    val pickupAddress: String,
    val status: CarpoolRideStatus,
    val acceptedByAdultId: String? = null,
    val acceptingCircleId: String? = null,
    val acceptingCircleName: String? = null,
    val vehicleId: String? = null,
    val vehicleLabel: String? = null,
)

@Serializable
data class CarpoolRideEvent(
    val eventKey: String,
    val title: String,
    val startsAt: String,
    val endsAt: String? = null,
    val defaultKidIds: List<String> = emptyList(),
    val ownRequest: CarpoolRide? = null,
    val otherRequests: List<CarpoolRide> = emptyList(),
)

@Serializable
data class EnableCarpoolSpaceRequest(
    val feedId: String,
)

@Serializable
data class JoinCarpoolSpaceRequest(
    val code: String,
)

@Serializable
data class CreateCarpoolRideRequest(
    val eventKey: String,
    val kidIds: List<String>? = null,
)

@Serializable
data class AcceptCarpoolRideRequest(
    val vehicleId: String,
)

fun circleDisplayName(name: String?): String {
    val trimmed = name?.trim()
    return if (trimmed.isNullOrEmpty()) "Your family" else trimmed
}

fun CarpoolFeedStatusKind.statusLabel(): String =
    when (this) {
        CarpoolFeedStatusKind.NONE -> "No carpool"
        CarpoolFeedStatusKind.AVAILABLE -> "Carpool available"
        CarpoolFeedStatusKind.REQUESTED -> "Requested"
        CarpoolFeedStatusKind.MEMBER -> "Member"
        CarpoolFeedStatusKind.OWNER -> "Owned"
    }

fun enableCarpoolConfirmMessage(feedName: String): String =
    "This family will own the carpool for $feedName and will admit or decline join requests. Enable carpool?"

fun CarpoolJoinRequest.displayLabel(): String {
    val circle = circleDisplayName(circleName)
    val by = requestedByDisplayName?.trim()?.takeIf { it.isNotEmpty() }
    return if (by == null) circle else "$circle · requested by $by"
}

fun CarpoolSummary.hasNoCarpools(): Boolean = feeds.isEmpty() && spaces.isEmpty()

fun CarpoolSummary.emptyHint(): String =
    if (circleRole == FamilyRole.ORGANIZER) {
        "Add a team calendar in Feeds, or paste an invite code."
    } else {
        "Paste an invite code to join a team carpool."
    }

enum class CarpoolPrimaryAction {
    ENABLE,
    REQUEST,
    OPEN,
    NONE,
}

fun CarpoolFeedStatus.primaryAction(circleRole: FamilyRole): CarpoolPrimaryAction =
    when {
        status == CarpoolFeedStatusKind.NONE && circleRole == FamilyRole.ORGANIZER ->
            CarpoolPrimaryAction.ENABLE
        status == CarpoolFeedStatusKind.AVAILABLE && !spaceId.isNullOrBlank() ->
            CarpoolPrimaryAction.REQUEST
        (status == CarpoolFeedStatusKind.MEMBER || status == CarpoolFeedStatusKind.OWNER) &&
            !spaceId.isNullOrBlank() ->
            CarpoolPrimaryAction.OPEN
        else -> CarpoolPrimaryAction.NONE
    }

fun carpoolStatusForFeed(
    summary: CarpoolSummary?,
    feedId: String,
    feedName: String,
): CarpoolFeedStatus =
    summary?.feeds?.find { it.feedId == feedId }
        ?: CarpoolFeedStatus(
            feedId = feedId,
            feedName = feedName,
            status = CarpoolFeedStatusKind.NONE,
        )
