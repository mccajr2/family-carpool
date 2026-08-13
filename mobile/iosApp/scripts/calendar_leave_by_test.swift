import Foundation

@main
struct CalendarLeaveByTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        func item(
            id: String,
            title: String = "Practice",
            leaveByStatus: String = "PENDING",
            leaveByAt: String? = nil,
            leaveByReason: String? = nil,
            leaveFromPlaceId: String? = "p1",
            source: String = "MANUAL"
        ) -> FamilyCalendarItem {
            FamilyCalendarItem(
                id: id,
                source: source,
                title: title,
                startsAt: "2026-08-15T17:00:00Z",
                endsAt: nil,
                location: "Rink",
                kidIds: ["k1"],
                feedId: nil,
                feedName: nil,
                leaveFromPlaceId: leaveFromPlaceId,
                leaveFromPlaceName: leaveFromPlaceId == "p1" ? "Home" : "Dad's",
                leaveByAt: leaveByAt,
                leaveByStatus: leaveByStatus,
                leaveByReason: leaveByReason
            )
        }

        let cachedOk = item(
            id: "e1",
            leaveByStatus: "OK",
            leaveByAt: "2026-08-15T16:00:00Z"
        )
        let incomingUnavailable = item(
            id: "e1",
            leaveByStatus: "UNAVAILABLE",
            leaveByReason: "NO_ORIGIN",
            leaveFromPlaceId: nil
        )
        expect(
            CalendarLeaveByMerge.mergeCheapCalendarItem(
                incoming: incomingUnavailable,
                cached: cachedOk
            ) == incomingUnavailable,
            "incoming UNAVAILABLE clears stale OK"
        )

        let incomingPending = item(id: "e1", title: "Practice refreshed")
        let kept = CalendarLeaveByMerge.mergeCheapCalendarItem(
            incoming: incomingPending,
            cached: cachedOk
        )
        expect(kept.title == "Practice refreshed", "cheap PENDING keeps refreshed title")
        expect(kept.leaveByStatus == "OK", "cheap PENDING keeps cached OK")
        expect(kept.leaveByAt == "2026-08-15T16:00:00Z", "cheap PENDING keeps cached leaveByAt")

        let originChanged = item(id: "e1", leaveFromPlaceId: "p2")
        expect(
            CalendarLeaveByMerge.mergeCheapCalendarItem(
                incoming: originChanged,
                cached: cachedOk
            ).leaveByStatus == "PENDING",
            "origin change drops stale OK to PENDING"
        )

        expect(
            CalendarLeaveByMerge.mergeCheapCalendarItem(
                incoming: incomingPending,
                cached: nil
            ).leaveByStatus == "PENDING",
            "no cache → PENDING"
        )

        let painted = [
            item(id: "e1"),
            item(id: "e2", title: "Game"),
        ]
        expect(
            LeaveByDisplay.leaveByAgendaLine(
                leaveByStatus: painted[0].leaveByStatus,
                leaveByAt: painted[0].leaveByAt,
                leaveByReason: painted[0].leaveByReason
            ) == LeaveByDisplay.pendingLabel,
            "cheap list paints PENDING before fill-in"
        )
        let filled = CalendarLeaveByMerge.applyLeaveByFillIn(
            items: painted,
            rows: [
                FamilyCalendarLeaveBy(
                    id: "e1",
                    source: "MANUAL",
                    leaveFromPlaceId: "p1",
                    leaveFromPlaceName: "Home",
                    leaveByAt: "2026-08-15T16:20:00Z",
                    leaveByStatus: "OK",
                    leaveByReason: nil
                ),
                FamilyCalendarLeaveBy(
                    id: "missing",
                    source: "MANUAL",
                    leaveFromPlaceId: nil,
                    leaveFromPlaceName: nil,
                    leaveByAt: "2026-08-15T16:00:00Z",
                    leaveByStatus: "OK",
                    leaveByReason: nil
                ),
            ]
        )
        expect(filled[0].leaveByStatus == "OK", "fill-in overwrites matching row")
        expect(filled[0].leaveByAt == "2026-08-15T16:20:00Z", "fill-in leaveByAt")
        expect(filled[1].leaveByStatus == "PENDING", "unknown fill-in ids ignored")
        expect(filled[1].leaveByAt == nil, "omitted row stays PENDING")

        let now = ManualEventDateCodec.date(fromIso: "2026-08-13T18:00:00Z")!
        let loaded = ManualEventDateCodec.defaultCalendarWindow(now: now)
        let near = ManualEventDateCodec.nearTermLeaveByWindow(
            loadedFromIso: loaded.from,
            loadedToIso: loaded.to,
            now: now
        )
        let rest = ManualEventDateCodec.remainderAfterNearTermLeaveByWindow(
            loadedFromIso: loaded.from,
            loadedToIso: loaded.to,
            now: now
        )
        expect(near != nil, "near-term window exists")
        expect(rest != nil, "remainder exists for 30-day window")
        expect(near!.from == loaded.from, "near-term starts at loaded from")
        expect(near!.to == rest!.from, "remainder starts when near-term ends")
        expect(rest!.to == loaded.to, "remainder ends at loaded to")
        let nearStart = ManualEventDateCodec.date(fromIso: near!.from)!
        let nearEnd = ManualEventDateCodec.date(fromIso: near!.to)!
        let nearDays = Calendar.current.dateComponents([.day], from: nearStart, to: nearEnd).day
        expect(nearDays == ManualEventDateCodec.leaveByNearTermDays, "near-term is +2 calendar days")

        let onlyNear = ManualEventDateCodec.advanceCalendarWindow(
            from: ManualEventDateCodec.startOfLocalDay(now),
            days: ManualEventDateCodec.leaveByNearTermDays
        )
        expect(
            ManualEventDateCodec.remainderAfterNearTermLeaveByWindow(
                loadedFromIso: onlyNear.from,
                loadedToIso: onlyNear.to,
                now: now
            ) == nil,
            "remainder is nil when window is only near-term"
        )

        let scriptsDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let authViewModelURL = scriptsDir
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/AuthViewModel.swift")
        let authViewModel = try! String(contentsOf: authViewModelURL, encoding: .utf8)
        expect(
            authViewModel.contains("listCalendarLeaveBy"),
            "AuthViewModel fetches leave-by fill-in"
        )
        expect(
            authViewModel.contains("mergeCheapCalendarItems"),
            "cheap list merges with cached leave-by"
        )
        expect(
            authViewModel.contains("calendarItems = CalendarLeaveByMerge.mergeCheapCalendarItems"),
            "Agenda paints cheap/merged items before fill-in"
        )
        let assignRange = authViewModel.range(
            of: "self.calendarItems = CalendarLeaveByMerge.mergeCheapCalendarItems"
        )!
        let fillRange = authViewModel.range(of: "self.fillLeaveByForWindow")!
        expect(
            assignRange.lowerBound < fillRange.lowerBound,
            "paint cheap list before starting leave-by fill-in"
        )
        expect(
            authViewModel.contains("nearTermLeaveByWindow"),
            "near-term slice is requested first"
        )
        expect(
            authViewModel.contains("remainderAfterNearTermLeaveByWindow"),
            "later window fill follows near-term"
        )
        let nearCall = authViewModel.range(of: "nearTermLeaveByWindow")!
        let restCall = authViewModel.range(of: "remainderAfterNearTermLeaveByWindow")!
        expect(
            nearCall.lowerBound < restCall.lowerBound,
            "near-term leave-by request is issued before later-window request"
        )
        expect(
            authViewModel.contains("waitForNearTermFill"),
            "Load more waits for near-term before filling the appended page"
        )
        expect(
            authViewModel.contains("fetchAndApplyLeaveBy(from: page.from, to: page.to"),
            "Load more fills leave-by for the appended page only"
        )
        expect(
            authViewModel.contains("Keep last known leave-by; do not wipe Agenda."),
            "fill-in failure keeps the list intact"
        )
        expect(
            !authViewModel.contains("self.calendarItems = []")
                || authViewModel.contains("onError: { _ in"),
            "leave-by onError must not clear calendarItems"
        )
        let listLeaveByError = authViewModel.range(
            of: "Keep last known leave-by; do not wipe Agenda."
        )!
        let afterError = authViewModel[listLeaveByError.upperBound...]
        let resumeNil = afterError.range(of: "continuation.resume(returning: nil)")
        expect(resumeNil != nil, "fill-in error returns nil rows instead of wiping")

        print("CalendarLeaveBy tests passed")
    }
}
