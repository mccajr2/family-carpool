package org.example.project

import platform.Foundation.NSUserDefaults

/** NSUserDefaults-backed family bootstrap store (not Keychain). */
class IosFamilyBootstrapCache(
    defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
) : FamilyBootstrapCache by JsonFamilyBootstrapCache(
        NsUserDefaultsCalendarCacheKeyValueStore(defaults),
    )
