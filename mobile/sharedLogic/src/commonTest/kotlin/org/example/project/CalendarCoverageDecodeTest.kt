package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.json.Json

class CalendarCoverageDecodeTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun decodesSpringStyleCalendarItemWithCoverages() {
        val payload =
            """
            [{
              "id":"11111111-1111-1111-1111-111111111111",
              "source":"MANUAL",
              "title":"Practice",
              "startsAt":"2030-08-15T17:00:00Z",
              "endsAt":null,
              "location":"Rink",
              "kidIds":["22222222-2222-2222-2222-222222222222"],
              "feedId":null,
              "feedName":null,
              "leaveFromPlaceId":null,
              "leaveFromPlaceName":null,
              "leaveByAt":null,
              "leaveByStatus":"UNAVAILABLE",
              "leaveByReason":"NO_ORIGIN",
              "coverages":[{
                "id":"33333333-3333-3333-3333-333333333333",
                "coveringAdultId":"44444444-4444-4444-4444-444444444444",
                "coveringAdultDisplayName":"Alex",
                "assignedByAdultId":"44444444-4444-4444-4444-444444444444",
                "kidIds":["22222222-2222-2222-2222-222222222222"],
                "status":"CONFIRMED"
              }],
              "uncoveredKidIds":[]
            }]
            """.trimIndent()
        val items = json.decodeFromString<List<CalendarItem>>(payload)
        assertEquals(1, items.size)
        assertEquals(CoverageStatus.CONFIRMED, items[0].coverages.single().status)
        assertEquals(emptyList(), items[0].uncoveredKidIds)
        assertEquals(emptyList(), items[0].conflicts)
        assertEquals(emptyList(), items[0].rsvps)
    }

    @Test
    fun decodesConflictsOnCalendarItem() {
        val payload =
            """
            {
              "id":"11111111-1111-1111-1111-111111111111",
              "source":"MANUAL",
              "title":"Practice",
              "startsAt":"2030-08-15T17:00:00Z",
              "kidIds":["22222222-2222-2222-2222-222222222222"],
              "leaveByStatus":"UNAVAILABLE",
              "coverages":[],
              "uncoveredKidIds":[],
              "conflicts":[{
                "type":"KID_TIME_OVERLAP",
                "kidId":"22222222-2222-2222-2222-222222222222",
                "adultId":null,
                "adultDisplayName":null,
                "otherSource":"MANUAL",
                "otherItemId":"55555555-5555-5555-5555-555555555555",
                "otherTitle":"Game",
                "otherStartsAt":"2030-08-15T17:30:00Z"
              }]
            }
            """.trimIndent()
        val item = json.decodeFromString<CalendarItem>(payload)
        assertEquals(CalendarConflictType.KID_TIME_OVERLAP, item.conflicts.single().type)
        assertEquals("Game", item.conflicts.single().otherTitle)
    }

    @Test
    fun decodesRsvpsOnCalendarItem() {
        val payload =
            """
            {
              "id":"11111111-1111-1111-1111-111111111111",
              "source":"MANUAL",
              "title":"Practice",
              "startsAt":"2030-08-15T17:00:00Z",
              "kidIds":["22222222-2222-2222-2222-222222222222","66666666-6666-6666-6666-666666666666"],
              "leaveByStatus":"UNAVAILABLE",
              "coverages":[],
              "uncoveredKidIds":["22222222-2222-2222-2222-222222222222"],
              "conflicts":[],
              "rsvps":[
                {"kidId":"22222222-2222-2222-2222-222222222222","status":"YES"},
                {"kidId":"66666666-6666-6666-6666-666666666666","status":"NO"}
              ]
            }
            """.trimIndent()
        val item = json.decodeFromString<CalendarItem>(payload)
        assertEquals(2, item.rsvps.size)
        assertEquals(RsvpStatus.YES, item.rsvps[0].status)
        assertEquals(RsvpStatus.NO, item.rsvps[1].status)
    }
}
