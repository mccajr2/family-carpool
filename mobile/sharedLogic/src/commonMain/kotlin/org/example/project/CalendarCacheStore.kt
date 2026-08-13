package org.example.project

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Soft TTL before returning to Calendar forces a background revalidate. */
const val CALENDAR_CACHE_SOFT_TTL_MS: Long = 5 * 60 * 1000L

private const val STORAGE_PREFIX = "family-carpool.calendar-cache:"

@Serializable
data class CalendarCacheSnapshot(
    val adultId: String,
    val circleId: String,
    val from: String,
    val to: String,
    val items: List<CalendarItem>,
    val fetchedAt: Long,
)

/**
 * Persists the last successful calendar GET per (adultId, circleId).
 * Not a secret store — do not use encrypted token storage.
 */
interface CalendarCacheStore {
    fun load(
        adultId: String,
        circleId: String,
    ): CalendarCacheSnapshot?

    fun save(snapshot: CalendarCacheSnapshot)

    fun patchItem(
        adultId: String,
        circleId: String,
        updated: CalendarItem,
    )

    fun clear(
        adultId: String,
        circleId: String,
    )

    fun clearAll()

    fun isStale(
        fetchedAt: Long,
        nowMs: Long,
    ): Boolean = nowMs - fetchedAt > CALENDAR_CACHE_SOFT_TTL_MS
}

/** Later of two ISO-8601 UTC instants (lexicographic compare is safe for this format). */
fun maxIsoInstant(
    a: String,
    b: String,
): String = if (a >= b) a else b

/** Platform-agnostic string KV used by [JsonCalendarCacheStore]. */
interface CalendarCacheKeyValueStore {
    fun getString(key: String): String?

    fun putString(
        key: String,
        value: String,
    )

    fun remove(key: String)

    fun keysWithPrefix(prefix: String): List<String>
}

class JsonCalendarCacheStore(
    private val kv: CalendarCacheKeyValueStore,
    private val json: Json =
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        },
) : CalendarCacheStore {
    override fun load(
        adultId: String,
        circleId: String,
    ): CalendarCacheSnapshot? {
        val raw = kv.getString(storageKey(adultId, circleId)) ?: return null
        return runCatching {
            val parsed = json.decodeFromString<CalendarCacheSnapshot>(raw)
            if (parsed.adultId != adultId || parsed.circleId != circleId) {
                null
            } else {
                parsed
            }
        }.getOrNull()
    }

    override fun save(snapshot: CalendarCacheSnapshot) {
        kv.putString(
            storageKey(snapshot.adultId, snapshot.circleId),
            json.encodeToString(snapshot),
        )
    }

    override fun patchItem(
        adultId: String,
        circleId: String,
        updated: CalendarItem,
    ) {
        val existing = load(adultId, circleId) ?: return
        save(
            existing.copy(
                items =
                    existing.items.map { row ->
                        if (row.source == updated.source && row.id == updated.id) updated else row
                    },
            ),
        )
    }

    override fun clear(
        adultId: String,
        circleId: String,
    ) {
        kv.remove(storageKey(adultId, circleId))
    }

    override fun clearAll() {
        for (key in kv.keysWithPrefix(STORAGE_PREFIX)) {
            kv.remove(key)
        }
    }

    private fun storageKey(
        adultId: String,
        circleId: String,
    ): String = "$STORAGE_PREFIX$adultId:$circleId"
}

class InMemoryCalendarCacheKeyValueStore : CalendarCacheKeyValueStore {
    private val map = linkedMapOf<String, String>()

    override fun getString(key: String): String? = map[key]

    override fun putString(
        key: String,
        value: String,
    ) {
        map[key] = value
    }

    override fun remove(key: String) {
        map.remove(key)
    }

    override fun keysWithPrefix(prefix: String): List<String> =
        map.keys.filter { it.startsWith(prefix) }
}

class InMemoryCalendarCacheStore :
    CalendarCacheStore by JsonCalendarCacheStore(InMemoryCalendarCacheKeyValueStore())
