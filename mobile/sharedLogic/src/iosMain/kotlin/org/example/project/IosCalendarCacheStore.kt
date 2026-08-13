package org.example.project

import platform.Foundation.NSUserDefaults

/** NSUserDefaults-backed calendar snapshot store (not Keychain). */
class IosCalendarCacheStore(
    defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
) : CalendarCacheStore by JsonCalendarCacheStore(
        NsUserDefaultsCalendarCacheKeyValueStore(defaults),
    )

internal class NsUserDefaultsCalendarCacheKeyValueStore(
    private val defaults: NSUserDefaults,
) : CalendarCacheKeyValueStore {
    override fun getString(key: String): String? = defaults.stringForKey(key)

    override fun putString(
        key: String,
        value: String,
    ) {
        defaults.setObject(value, forKey = key)
    }

    override fun remove(key: String) {
        defaults.removeObjectForKey(key)
    }

    override fun keysWithPrefix(prefix: String): List<String> {
        val dict = defaults.dictionaryRepresentation()
        return dict.keys.mapNotNull { key ->
            // NSDictionary keys arrive as NSString; `as? String` alone often fails.
            val asString =
                key as? String
                    ?: (key as? platform.Foundation.NSString)?.toString()
                    ?: key?.toString()
                    ?: return@mapNotNull null
            if (asString.startsWith(prefix)) asString else null
        }
    }
}
