import Foundation

struct FamilyCalendarItem: Identifiable, Equatable {
    let id: String
    let source: String
    var title: String
    var startsAt: String
    var endsAt: String?
    var location: String?
    var kidIds: [String]
    var feedId: String?
    var feedName: String?
    var leaveFromPlaceId: String?
    var leaveFromPlaceName: String?
    var leaveByAt: String?
    var leaveByStatus: String
    var leaveByReason: String?
    var coverages: [FamilyCoverageAssignment] = []
    var uncoveredKidIds: [String] = []
    var conflicts: [FamilyCalendarConflict] = []
    var rsvps: [FamilyCalendarRsvp] = []

    var isManual: Bool { source == "MANUAL" }

    func applyingLeaveBy(
        leaveFromPlaceId: String?,
        leaveFromPlaceName: String?,
        leaveByAt: String?,
        leaveByStatus: String,
        leaveByReason: String?
    ) -> FamilyCalendarItem {
        var next = self
        next.leaveFromPlaceId = leaveFromPlaceId
        next.leaveFromPlaceName = leaveFromPlaceName
        next.leaveByAt = leaveByAt
        next.leaveByStatus = leaveByStatus
        next.leaveByReason = leaveByReason
        return next
    }
}

/// Fill-in row from GET …/calendar/leave-by (never PENDING).
struct FamilyCalendarLeaveBy: Equatable {
    let id: String
    let source: String
    var leaveFromPlaceId: String?
    var leaveFromPlaceName: String?
    var leaveByAt: String?
    var leaveByStatus: String
    var leaveByReason: String?
}

enum CalendarLeaveByMerge {
    static func calendarRowKey(source: String, id: String) -> String {
        "\(source):\(id)"
    }

    /// Cheap list onto a cached row: settled UNAVAILABLE/OK replace; PENDING keeps
    /// cached settled leave-by when origin is unchanged (avoid flicker).
    static func mergeCheapCalendarItem(
        incoming: FamilyCalendarItem,
        cached: FamilyCalendarItem?
    ) -> FamilyCalendarItem {
        if incoming.leaveByStatus != "PENDING" {
            return incoming
        }
        if let cached,
           cached.leaveFromPlaceId == incoming.leaveFromPlaceId,
           cached.leaveByStatus == "OK" || cached.leaveByStatus == "UNAVAILABLE"
        {
            return incoming.applyingLeaveBy(
                leaveFromPlaceId: incoming.leaveFromPlaceId,
                leaveFromPlaceName: incoming.leaveFromPlaceName,
                leaveByAt: cached.leaveByAt,
                leaveByStatus: cached.leaveByStatus,
                leaveByReason: cached.leaveByReason
            )
        }
        return incoming
    }

    static func mergeCheapCalendarItems(
        incoming: [FamilyCalendarItem],
        cached: [FamilyCalendarItem]
    ) -> [FamilyCalendarItem] {
        let byKey = Dictionary(
            uniqueKeysWithValues: cached.map { (calendarRowKey(source: $0.source, id: $0.id), $0) }
        )
        return incoming.map { row in
            mergeCheapCalendarItem(
                incoming: row,
                cached: byKey[calendarRowKey(source: row.source, id: row.id)]
            )
        }
    }

    /// Fill-in always overwrites leave-by fields for matching (source, id).
    static func applyLeaveByFillIn(
        items: [FamilyCalendarItem],
        rows: [FamilyCalendarLeaveBy]
    ) -> [FamilyCalendarItem] {
        let byKey = Dictionary(
            uniqueKeysWithValues: rows.map { (calendarRowKey(source: $0.source, id: $0.id), $0) }
        )
        return items.map { item in
            guard let fill = byKey[calendarRowKey(source: item.source, id: item.id)] else {
                return item
            }
            return item.applyingLeaveBy(
                leaveFromPlaceId: fill.leaveFromPlaceId,
                leaveFromPlaceName: fill.leaveFromPlaceName,
                leaveByAt: fill.leaveByAt,
                leaveByStatus: fill.leaveByStatus,
                leaveByReason: fill.leaveByReason
            )
        }
    }
}
