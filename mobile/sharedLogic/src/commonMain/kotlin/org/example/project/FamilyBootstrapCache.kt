package org.example.project

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private const val BOOTSTRAP_PREFIX = "family-carpool.family-bootstrap:"

/**
 * Last successful Ready shell for an adult — circle + invite + feeds.
 * Used to paint the app shell (and pair with [CalendarCacheStore]) before getCircle returns.
 */
@Serializable
data class FamilyBootstrapSnapshot(
    val adultId: String,
    val email: String,
    val adultDisplayName: String? = null,
    val circle: FamilyCircle,
    val inviteCode: String? = null,
    val feeds: List<ActivityFeed> = emptyList(),
)

interface FamilyBootstrapCache {
    fun load(adultId: String): FamilyBootstrapSnapshot?

    fun save(snapshot: FamilyBootstrapSnapshot)

    fun clear(adultId: String)

    /** Most recently saved adult — for sync paint before getMe. */
    fun lastAdultId(): String?
}

class JsonFamilyBootstrapCache(
    private val kv: CalendarCacheKeyValueStore,
    private val json: Json =
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        },
) : FamilyBootstrapCache {
    override fun load(adultId: String): FamilyBootstrapSnapshot? {
        val raw = kv.getString(storageKey(adultId)) ?: return null
        return runCatching {
            val parsed = json.decodeFromString<FamilyBootstrapSnapshot>(raw)
            if (parsed.adultId != adultId) null else parsed
        }.getOrNull()
    }

    override fun save(snapshot: FamilyBootstrapSnapshot) {
        kv.putString(storageKey(snapshot.adultId), json.encodeToString(snapshot))
        kv.putString(LAST_ADULT_KEY, snapshot.adultId)
    }

    override fun clear(adultId: String) {
        kv.remove(storageKey(adultId))
        if (kv.getString(LAST_ADULT_KEY) == adultId) {
            kv.remove(LAST_ADULT_KEY)
        }
    }

    override fun lastAdultId(): String? = kv.getString(LAST_ADULT_KEY)

    private fun storageKey(adultId: String): String = "$BOOTSTRAP_PREFIX$adultId"

    companion object {
        private const val LAST_ADULT_KEY = "family-carpool.family-bootstrap-last-adult"
    }
}

class InMemoryFamilyBootstrapCache :
    FamilyBootstrapCache by JsonFamilyBootstrapCache(InMemoryCalendarCacheKeyValueStore())
