package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FamilyBootstrapCacheTest {
    @Test
    fun roundTripsByAdultId() {
        val store = InMemoryFamilyBootstrapCache()
        val snapshot =
            FamilyBootstrapSnapshot(
                adultId = "a1",
                email = "parent@example.com",
                adultDisplayName = "Alex",
                circle =
                    FamilyCircle(
                        id = "c1",
                        name = "House",
                        role = FamilyRole.ORGANIZER,
                        members =
                            listOf(
                                FamilyMember(
                                    adultId = "a1",
                                    email = "parent@example.com",
                                    displayName = "Alex",
                                    role = FamilyRole.ORGANIZER,
                                ),
                            ),
                        kids = listOf(Kid(id = "k1", displayName = "Sam")),
                    ),
                inviteCode = "AB12CD34",
                feeds = emptyList(),
            )
        store.save(snapshot)
        assertEquals(snapshot, store.load("a1"))
        assertEquals("a1", store.lastAdultId())
        assertNull(store.load("a2"))
    }

    @Test
    fun clearRemovesOnlyThatAdult() {
        val store = InMemoryFamilyBootstrapCache()
        store.save(
            FamilyBootstrapSnapshot(
                adultId = "a1",
                email = "a@example.com",
                circle = FamilyCircle(id = "c1", role = FamilyRole.CAREGIVER),
            ),
        )
        store.save(
            FamilyBootstrapSnapshot(
                adultId = "a2",
                email = "b@example.com",
                circle = FamilyCircle(id = "c2", role = FamilyRole.CAREGIVER),
            ),
        )
        store.clear("a1")
        assertNull(store.load("a1"))
        assertEquals("c2", store.load("a2")!!.circle.id)
        assertEquals("a2", store.lastAdultId())
        store.clear("a2")
        assertNull(store.lastAdultId())
    }
}
