package org.example.project

import android.content.Context

/** Plain SharedPreferences family bootstrap store (not encrypted token storage). */
class AndroidFamilyBootstrapCache(
    context: Context,
) : FamilyBootstrapCache by JsonFamilyBootstrapCache(
        SharedPreferencesCalendarCacheKeyValueStore(
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE),
        ),
    ) {
    companion object {
        private const val PREFS_NAME = "family_carpool_calendar"
    }
}
