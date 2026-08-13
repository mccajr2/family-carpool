package org.example.project

import platform.Foundation.NSUserDefaults

/** NSUserDefaults-backed calendar snapshot store (not Keychain). */
class IosCalendarCacheStore :
    CalendarCacheStore by JsonCalendarCacheStore(
        NsUserDefaultsCalendarCacheKeyValueStore(NSUserDefaults.standardUserDefaults),
    )

private class NsUserDefaultsCalendarCacheKeyValueStore(
    private val defaults: NSUserDefaults,
) : CalendarCacheKeyValueStore {
    override fun getString(key: String): String? = defaults.stringForKey(key)

    override fun putString(
        key: String,
        value: String,
    ) {
        defaults.setObject(value, key)
    }

    override fun remove(key: String) {
        defaults.removeObjectForKey(key)
    }

    override fun keysWithPrefix(prefix: String): List<String> {
        val dict = defaults.dictionaryRepresentation()
        return dict.keys.mapNotNull { key ->
            val asString = key as? String ?: return@mapNotNull null
            if (asString.startsWith(prefix)) asString else null
        }
    }
}
