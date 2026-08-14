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
    fun carpoolTabLabelsAreNotComingSoon() {
        assertEquals("Loading carpool…", AppShell.CARPOOL_LOADING)
        assertEquals("Have a code?", AppShell.CARPOOL_HAVE_A_CODE)
        assertEquals("Enable", AppShell.CARPOOL_ENABLE)
    }

    @Test
    fun moreGeneralRowsOmitFeedsForCaregiver() {
        assertEquals(listOf("Places", "Garage", "Feeds"), AppShell.moreGeneralRows(isOrganizer = true))
        assertEquals(listOf("Places", "Garage"), AppShell.moreGeneralRows(isOrganizer = false))
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
