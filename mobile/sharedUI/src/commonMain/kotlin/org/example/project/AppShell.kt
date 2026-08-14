package org.example.project

/**
 * Shared signed-in shell IA labels (web/iOS mirror these strings).
 * Kept in one place so tests fail if destination naming drifts.
 */
object AppShell {
    const val TAB_CALENDAR = "Calendar"
    const val TAB_CARPOOL = "Carpool"
    const val TAB_FAMILY = "Family"
    const val TAB_MORE = "More"

    const val CARPOOL_LOADING = "Loading carpool…"
    const val CARPOOL_HAVE_A_CODE = "Have a code?"
    const val CARPOOL_ENABLE = "Enable"
    const val CARPOOL_REQUEST = "Request"
    const val CARPOOL_OPEN = "Open"

    const val MORE_GROUP_GENERAL = "General"
    const val MORE_GROUP_ACCOUNT = "Account"
    const val ROW_PLACES = "Places"
    const val ROW_FEEDS = "Feeds"
    const val ROW_SIGN_OUT = "Sign out"

    /** Focused-control busy labels (Agenda contract — never put these on Sign out). */
    const val BUSY_SAVING = "Saving…"
    const val BUSY_LOADING = "Loading…"

    val primaryTabs: List<String> =
        listOf(TAB_CALENDAR, TAB_CARPOOL, TAB_FAMILY, TAB_MORE)

    fun moreGeneralRows(isOrganizer: Boolean): List<String> =
        buildList {
            add(ROW_PLACES)
            if (isOrganizer) {
                add(ROW_FEEDS)
            }
        }

    fun showsFeedsRow(isOrganizer: Boolean): Boolean = isOrganizer
}
