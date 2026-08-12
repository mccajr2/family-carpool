package org.example.project

fun calendarItemKey(item: CalendarItem): String = "${item.source}-${item.id}"

fun coverageStatusLabel(status: CoverageStatus): String =
    when (status) {
        CoverageStatus.PENDING -> "Pending"
        CoverageStatus.CONFIRMED -> "Confirmed"
        CoverageStatus.DECLINED -> "Declined"
    }

fun memberLabel(member: FamilyMember): String =
    member.displayName?.trim()?.takeIf { it.isNotEmpty() } ?: member.email

fun coverageAdultLabel(
    coverage: CalendarCoverageAssignment,
    members: List<FamilyMember>,
): String {
    coverage.coveringAdultDisplayName?.trim()?.takeIf { it.isNotEmpty() }?.let {
        return it
    }
    return members.find { it.adultId == coverage.coveringAdultId }?.let(::memberLabel)
        ?: "Adult"
}

fun eventKidNames(
    kidIds: List<String>,
    kids: List<Kid>,
): String =
    kidIds
        .mapNotNull { id -> kids.find { it.id == id }?.displayName?.trim()?.takeIf { it.isNotEmpty() } }
        .joinToString(", ")

fun coverageKidNames(
    coverage: CalendarCoverageAssignment,
    kids: List<Kid>,
): String = eventKidNames(coverage.kidIds, kids)

fun activeCoverages(item: CalendarItem): List<CalendarCoverageAssignment> =
    item.coverages.filter {
        it.status == CoverageStatus.PENDING || it.status == CoverageStatus.CONFIRMED
    }

fun pendingCoverageForAdult(
    item: CalendarItem,
    adultId: String,
): CalendarCoverageAssignment? =
    activeCoverages(item).find {
        it.status == CoverageStatus.PENDING && it.coveringAdultId == adultId
    }

/** Prefer the signed-in adult when they are in the circle; else sole member; else first. */
fun defaultCoverageAdultId(
    currentAdultId: String,
    members: List<FamilyMember>,
): String {
    if (members.size == 1) {
        return members.first().adultId
    }
    if (members.any { it.adultId == currentAdultId }) {
        return currentAdultId
    }
    return members.firstOrNull()?.adultId.orEmpty()
}

/** Single uncovered kid is implicitly selected — no chooser needed. */
fun defaultCoverageKidIds(uncoveredKidIds: List<String>): Set<String> =
    if (uncoveredKidIds.size == 1) uncoveredKidIds.toSet() else emptySet()
