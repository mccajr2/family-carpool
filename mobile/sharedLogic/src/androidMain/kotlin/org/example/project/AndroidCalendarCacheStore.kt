package org.example.project

import android.content.Context

/** Plain SharedPreferences calendar snapshot store (not encrypted token storage). */
class AndroidCalendarCacheStore(
    context: Context,
) : CalendarCacheStore by JsonCalendarCacheStore(
        SharedPreferencesCalendarCacheKeyValueStore(
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE),
        ),
    ) {
    companion object {
        private const val PREFS_NAME = "family_carpool_calendar"
    }
}

private class SharedPreferencesCalendarCacheKeyValueStore(
    private val prefs: android.content.SharedPreferences,
) : CalendarCacheKeyValueStore {
    override fun getString(key: String): String? = prefs.getString(key, null)

    override fun putString(
        key: String,
        value: String,
    ) {
        prefs.edit().putString(key, value).apply()
    }

    override fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }

    override fun keysWithPrefix(prefix: String): List<String> =
        prefs.all.keys.filter { it.startsWith(prefix) }
}
