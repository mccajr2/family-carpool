package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppShellTest {
    @Test
    fun primaryTabsMatchSignedInIaOrder() {
        assertEquals(
            listOf("Calendar", "Carpool", "Family", "More"),
            AppShell.primaryTabs,
        )
    }

    @Test
    fun carpoolPlaceholderIsComingSoon() {
        assertEquals("Coming soon", AppShell.CARPOOL_PLACEHOLDER)
    }

    @Test
    fun moreGeneralRowsOmitFeedsForCaregiver() {
        assertEquals(listOf("Places", "Feeds"), AppShell.moreGeneralRows(isOrganizer = true))
        assertEquals(listOf("Places"), AppShell.moreGeneralRows(isOrganizer = false))
        assertTrue(AppShell.showsFeedsRow(isOrganizer = true))
        assertFalse(AppShell.showsFeedsRow(isOrganizer = false))
    }

    @Test
    fun focusedBusyLabelsNeverHijackSignOut() {
        assertEquals("Sign out", AppShell.ROW_SIGN_OUT)
        assertEquals("Saving…", AppShell.BUSY_SAVING)
        assertEquals("Loading…", AppShell.BUSY_LOADING)
        assertFalse(AppShell.ROW_SIGN_OUT.contains("Working"))
    }
}
