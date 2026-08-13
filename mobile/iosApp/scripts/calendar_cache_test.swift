import Foundation

/// Pure helpers mirroring AuthViewModel calendar cache ISO/TTL behavior (no SharedLogic).
enum CalendarCacheHelpers {
    static let softTtlMs: Int64 = 5 * 60 * 1000

    static func maxIsoInstant(_ a: String, _ b: String) -> String {
        a >= b ? a : b
    }

    static func isStale(fetchedAtMs: Int64, nowMs: Int64, softTtlMs: Int64 = softTtlMs) -> Bool {
        nowMs - fetchedAtMs > softTtlMs
    }
}

@main
struct CalendarCacheTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        expect(
            CalendarCacheHelpers.maxIsoInstant(
                "2026-08-01T00:00:00.000Z",
                "2026-09-01T00:00:00.000Z"
            ) == "2026-09-01T00:00:00.000Z",
            "maxIsoInstant picks later"
        )

        let fetchedAt: Int64 = 1_000_000
        expect(
            !CalendarCacheHelpers.isStale(
                fetchedAtMs: fetchedAt,
                nowMs: fetchedAt + CalendarCacheHelpers.softTtlMs
            ),
            "not stale at TTL boundary"
        )
        expect(
            CalendarCacheHelpers.isStale(
                fetchedAtMs: fetchedAt,
                nowMs: fetchedAt + CalendarCacheHelpers.softTtlMs + 1
            ),
            "stale after TTL"
        )

        fputs("OK calendar_cache_test\n", stderr)
    }
}
