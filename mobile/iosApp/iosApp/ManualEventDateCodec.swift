import Foundation

enum ManualEventDateCodec {
    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    private static let isoWithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(fromIso value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return isoWithFractional.date(from: trimmed) ?? isoPlain.date(from: trimmed)
    }

    static func isoString(from date: Date) -> String {
        isoPlain.string(from: date)
    }

    static func displayString(fromIso value: String) -> String? {
        guard let date = date(fromIso: value) else { return nil }
        return displayFormatter.string(from: date)
    }

    /// Client-side rules: start in the future; end on or after start.
    static func validationMessage(startsAt: Date, endsAt: Date?, now: Date = Date()) -> String? {
        if startsAt < now {
            return "Start must be in the future"
        }
        guard let endsAt else { return nil }
        if endsAt < startsAt {
            return "End must be on or after start"
        }
        return nil
    }

    static let calendarPageDays = 30

    /// Near-term leave-by fill-in: local today through +2 calendar days.
    static let leaveByNearTermDays = 2

    static func defaultCalendarWindow(now: Date = Date()) -> (from: String, to: String) {
        advanceCalendarWindow(from: startOfLocalDay(now), days: calendarPageDays)
    }

    static func startOfLocalDay(_ now: Date = Date()) -> Date {
        Calendar.current.startOfDay(for: now)
    }

    static func advanceCalendarWindow(from: Date, days: Int = calendarPageDays) -> (from: String, to: String) {
        let calendar = Calendar.current
        let end = calendar.date(byAdding: .day, value: days, to: from) ?? from
        return (isoString(from: from), isoString(from: end))
    }

    static func advanceCalendarWindow(fromIso: String, days: Int = calendarPageDays) -> (from: String, to: String) {
        let from = date(fromIso: fromIso) ?? Date()
        return advanceCalendarWindow(from: from, days: days)
    }

    static func calendarWindowThrough(loadedToIso: String, now: Date = Date()) -> (from: String, to: String) {
        (isoString(from: startOfLocalDay(now)), loadedToIso)
    }

    static func ensureCalendarWindowCovers(loadedToIso: String, instant: Date) -> String {
        let instantIso = isoString(from: instant)
        var to = loadedToIso
        var guardCount = 0
        while instantIso >= to && guardCount < 120 {
            to = advanceCalendarWindow(fromIso: to).to
            guardCount += 1
        }
        return to
    }

    static func laterIso(_ a: String, _ b: String) -> String {
        a >= b ? a : b
    }

    static func earlierIso(_ a: String, _ b: String) -> String {
        a <= b ? a : b
    }

    static func intersectIsoWindows(
        _ a: (from: String, to: String),
        _ b: (from: String, to: String)
    ) -> (from: String, to: String)? {
        let from = laterIso(a.from, b.from)
        let to = earlierIso(a.to, b.to)
        if from >= to {
            return nil
        }
        return (from, to)
    }

    /// `[localTodayStart, localTodayStart + 2d)` ∩ loaded window.
    static func nearTermLeaveByWindow(
        loadedFromIso: String,
        loadedToIso: String,
        now: Date = Date()
    ) -> (from: String, to: String)? {
        let near = advanceCalendarWindow(from: startOfLocalDay(now), days: leaveByNearTermDays)
        return intersectIsoWindows(near, (loadedFromIso, loadedToIso))
    }

    /// Remainder of the loaded window after the near-term slice.
    static func remainderAfterNearTermLeaveByWindow(
        loadedFromIso: String,
        loadedToIso: String,
        now: Date = Date()
    ) -> (from: String, to: String)? {
        let near = advanceCalendarWindow(from: startOfLocalDay(now), days: leaveByNearTermDays)
        let from = laterIso(loadedFromIso, near.to)
        if from >= loadedToIso {
            return nil
        }
        return (from, loadedToIso)
    }
}
