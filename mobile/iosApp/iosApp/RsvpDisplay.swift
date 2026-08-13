import Foundation

struct FamilyCalendarRsvp: Equatable, Codable {
    let kidId: String
    let status: String
}

/// Agenda RSVP copy / helpers (mirrors sharedUI RsvpDisplay.kt / web rsvpDisplay.ts).
enum RsvpDisplay {
    static func statusLabel(_ status: String) -> String {
        switch status.uppercased() {
        case "YES":
            return "Yes"
        case "NO":
            return "No"
        case "NO_RESPONSE":
            return "No response"
        default:
            return status
        }
    }

    static func statusForKid(item: FamilyCalendarItem, kidId: String) -> String {
        item.rsvps.first(where: { $0.kidId == kidId })?.status ?? "NO_RESPONSE"
    }

    /// Out of play when every kid on the item is RSVP No (includes one-kid No).
    static func isAgendaItemOutOfPlay(_ item: FamilyCalendarItem) -> Bool {
        guard !item.kidIds.isEmpty else { return false }
        return item.kidIds.allSatisfy { statusForKid(item: item, kidId: $0) == "NO" }
    }

    static func kidHasActiveCoverage(item: FamilyCalendarItem, kidId: String) -> Bool {
        item.coverages.contains { coverage in
            (coverage.status == "PENDING" || coverage.status == "CONFIRMED")
                && coverage.kidIds.contains(kidId)
        }
    }

    static func coverageReleaseMessage(kidName: String) -> String {
        "This will remove coverage for \(kidName)."
    }
}
