package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CoverageDisplayTest {

    @Test
    fun activeCoveragesExcludesDeclined() {
        val item =
            CalendarItem(
                id = "e1",
                source = CalendarItemSource.MANUAL,
                title = "Practice",
                startsAt = "2030-08-15T17:00:00Z",
                coverages =
                    listOf(
                        CalendarCoverageAssignment(
                            id = "a1",
                            coveringAdultId = "1",
                            assignedByAdultId = "1",
                            kidIds = listOf("k1"),
                            status = CoverageStatus.CONFIRMED,
                        ),
                        CalendarCoverageAssignment(
                            id = "a2",
                            coveringAdultId = "2",
                            assignedByAdultId = "1",
                            kidIds = listOf("k2"),
                            status = CoverageStatus.DECLINED,
                        ),
                    ),
                uncoveredKidIds = listOf("k2"),
            )

        assertEquals(1, activeCoverages(item).size)
        assertEquals("a1", activeCoverages(item).single().id)
    }

    @Test
    fun pendingCoverageForAdultFindsPendingRow() {
        val item =
            CalendarItem(
                id = "e1",
                source = CalendarItemSource.MANUAL,
                title = "Practice",
                startsAt = "2030-08-15T17:00:00Z",
                coverages =
                    listOf(
                        CalendarCoverageAssignment(
                            id = "a1",
                            coveringAdultId = "2",
                            assignedByAdultId = "1",
                            kidIds = listOf("k1"),
                            status = CoverageStatus.PENDING,
                        ),
                    ),
            )

        assertEquals("a1", pendingCoverageForAdult(item, "2")?.id)
        assertNull(pendingCoverageForAdult(item, "1"))
    }

    @Test
    fun coverageLabelsUseMemberAndKidNames() {
        val coverage =
            CalendarCoverageAssignment(
                id = "a1",
                coveringAdultId = "2",
                assignedByAdultId = "1",
                kidIds = listOf("k1", "k2"),
                status = CoverageStatus.PENDING,
            )
        val members =
            listOf(
                FamilyMember(
                    adultId = "2",
                    email = "sam@example.com",
                    displayName = "Sam",
                    role = FamilyRole.CAREGIVER,
                ),
            )
        val kids =
            listOf(
                Kid(id = "k1", displayName = "Alex"),
                Kid(id = "k2", displayName = "Jordan"),
            )

        assertEquals("Sam", coverageAdultLabel(coverage, members))
        assertEquals("Alex, Jordan", coverageKidNames(coverage, kids))
        assertEquals("Pending", coverageStatusLabel(CoverageStatus.PENDING))
    }

    @Test
    fun defaultCoverageAdultIdPrefersSignedInAdult() {
        val members =
            listOf(
                FamilyMember("2", "other@example.com", "Jordan", FamilyRole.CAREGIVER),
                FamilyMember("1", "me@example.com", "Alex", FamilyRole.ORGANIZER),
            )
        assertEquals("1", defaultCoverageAdultId("1", members))
        assertEquals("2", defaultCoverageAdultId("2", listOf(members[0])))
        assertEquals(emptySet(), defaultCoverageKidIds(listOf("k1", "k2")))
        assertEquals(setOf("k1"), defaultCoverageKidIds(listOf("k1")))
    }
}
