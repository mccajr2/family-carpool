import Foundation

/// Pure helpers mirroring AuthViewModel calendar cache ISO/TTL + Ready paint flags
/// (no SharedLogic).
enum CalendarCacheHelpers {
    static let softTtlMs: Int64 = 5 * 60 * 1000

    static func maxIsoInstant(_ a: String, _ b: String) -> String {
        a >= b ? a : b
    }

    static func isStale(fetchedAtMs: Int64, nowMs: Int64, softTtlMs: Int64 = softTtlMs) -> Bool {
        nowMs - fetchedAtMs > softTtlMs
    }

    /// Mirror of applyReady: only background-revalidate when peek painted non-empty items.
    static func shouldBackgroundRevalidate(paintedItemCount: Int) -> Bool {
        paintedItemCount > 0
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

        expect(
            CalendarCacheHelpers.shouldBackgroundRevalidate(paintedItemCount: 2),
            "non-empty cache → background revalidate (no global spinner)"
        )
        expect(
            !CalendarCacheHelpers.shouldBackgroundRevalidate(paintedItemCount: 0),
            "empty/miss → foreground load"
        )

        // AuthViewModel.applyReady must use peekCalendarCache callback (List→Array bridging),
        // not CalendarCacheBridgeHit property access.
        let authViewModelURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/AuthViewModel.swift")
        let authViewModel = try! String(contentsOf: authViewModelURL, encoding: .utf8)
        expect(
            authViewModel.contains("peekCalendarCache"),
            "applyReady peeks calendar cache"
        )
        expect(
            authViewModel.contains("backgroundRevalidate: !calendarItems.isEmpty") ||
                authViewModel.contains("backgroundRevalidate: paintedFromCache"),
            "Ready uses cache paint for background revalidate (no global spinner)"
        )
        expect(
            authViewModel.contains("fetchedAt.int64Value"),
            "callback Long is unboxed via int64Value"
        )
        expect(
            authViewModel.contains("loadInvite"),
            "invite loads after Ready so Agenda can paint first"
        )
        expect(
            !authViewModel.contains("if let hit = bridge.peekCalendarCache()"),
            "must not peek via BridgeHit property return (Swift List bridging)"
        )
        expect(
            authViewModel.contains("paintBootstrapIfPresent"),
            "loadFamily paints bootstrap shell before getCircle"
        )
        expect(
            authViewModel.contains("deferNetworkLoads: true"),
            "bootstrap applyReady must not double-fetch calendar while getCircle is in flight"
        )
        expect(
            authViewModel.contains("peekBootstrapFeeds") &&
                authViewModel.contains("paintBootstrapFeeds"),
            "bootstrap paints feeds before getCircle / listFeeds"
        )

        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let contentView = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(
            contentView.contains("case .loading:"),
            "membership loading phase still handled"
        )
        // Quiet wait — no ProgressView on the loading membership shell.
        let loadingCaseRange = contentView.range(of: "case .loading:")!
        let afterLoading = contentView[loadingCaseRange.upperBound...]
        let nextCase = afterLoading.range(of: "case .")!
        let loadingBody = String(afterLoading[..<nextCase.lowerBound])
        expect(
            !loadingBody.contains("ProgressView"),
            "loading membership must not show a full-screen ProgressView"
        )

        fputs("OK calendar_cache_test\n", stderr)
    }
}
