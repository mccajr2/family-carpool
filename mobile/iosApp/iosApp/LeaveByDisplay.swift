import Foundation

/// Agenda leave-by copy helpers (estimate only — never live traffic / ETA).
enum LeaveByDisplay {
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
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

    static func formatLeaveByTime(iso: String) -> String {
        let trimmed = iso.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return iso }
        guard let date = isoWithFractional.date(from: trimmed) ?? isoPlain.date(from: trimmed) else {
            return iso
        }
        return timeFormatter.string(from: date)
    }

    static let pendingLabel = "Estimating leave-by…"

    /// e.g. "Leave by ~3:40 PM · estimate"
    static func formatLeaveByEstimateLine(leaveByAtIso: String) -> String {
        "Leave by ~\(formatLeaveByTime(iso: leaveByAtIso)) · estimate"
    }

    static func leaveByUnavailableLabel(reason: String?) -> String {
        switch reason {
        case "NO_ORIGIN":
            return "No leave-from place yet"
        case "NO_DESTINATION":
            return "Add a location to estimate leave-by"
        case "GEOCODE_FAILED":
            return "Couldn't locate the destination"
        default:
            return "Leave-by estimate unavailable"
        }
    }

    static func leaveByAgendaLine(
        leaveByStatus: String,
        leaveByAt: String?,
        leaveByReason: String?
    ) -> String {
        if leaveByStatus == "PENDING" {
            return pendingLabel
        }
        if leaveByStatus == "OK", let leaveByAt, !leaveByAt.isEmpty {
            return formatLeaveByEstimateLine(leaveByAtIso: leaveByAt)
        }
        return leaveByUnavailableLabel(reason: leaveByReason)
    }
}
