import Foundation

@main
struct LeaveByDisplayTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        let line = LeaveByDisplay.formatLeaveByEstimateLine(leaveByAtIso: "2026-08-15T15:25:00Z")
        expect(line.hasPrefix("Leave by ~"), "estimate line starts with Leave by ~")
        expect(line.hasSuffix(" · estimate"), "estimate line ends with · estimate")
        let lower = line.lowercased()
        expect(!lower.contains("live traffic"), "no live traffic wording")
        expect(!lower.contains("live-traffic"), "no live-traffic wording")
        // Word-boundary ETA (do not match inside "estimate")
        let etaPattern = try! NSRegularExpression(pattern: #"\beta\b"#)
        let range = NSRange(lower.startIndex..<lower.endIndex, in: lower)
        expect(etaPattern.firstMatch(in: lower, range: range) == nil, "no ETA wording")

        expect(
            LeaveByDisplay.leaveByUnavailableLabel(reason: "NO_ORIGIN") == "No leave-from place yet",
            "NO_ORIGIN label"
        )
        expect(
            LeaveByDisplay.leaveByUnavailableLabel(reason: "NO_DESTINATION")
                == "Add a location to estimate leave-by",
            "NO_DESTINATION label"
        )
        expect(
            LeaveByDisplay.leaveByUnavailableLabel(reason: "GEOCODE_FAILED")
                == "Couldn't locate the destination",
            "GEOCODE_FAILED label"
        )
        expect(
            LeaveByDisplay.leaveByUnavailableLabel(reason: nil) == "Leave-by estimate unavailable",
            "default unavailable label"
        )

        let okLine =
            LeaveByDisplay.leaveByAgendaLine(
                leaveByStatus: "OK",
                leaveByAt: "2026-08-15T16:30:00Z",
                leaveByReason: nil
            )
        expect(okLine.hasSuffix(" · estimate"), "OK agenda line is estimate")

        let unavailableLine =
            LeaveByDisplay.leaveByAgendaLine(
                leaveByStatus: "UNAVAILABLE",
                leaveByAt: nil,
                leaveByReason: "NO_ORIGIN"
            )
        expect(unavailableLine == "No leave-from place yet", "UNAVAILABLE agenda line")

        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(content.contains("leaveByAgendaLine"), "Agenda shows leave-by line")
        expect(content.contains("Open Places"), "Agenda has Open Places recovery")
        expect(
            !content.contains("Edit location"),
            "Agenda does not show Edit location (destination via Edit)"
        )
        expect(content.contains("Leave from"), "Agenda has leave-from control")
        expect(content.contains("Button(\"Edit\")"), "manual rows keep Edit")
        expect(content.contains("Remove event"), "manual rows keep Remove event")
        expect(!content.lowercased().contains("live traffic"), "ContentView has no live traffic")
        expect(!content.contains("\"ETA\""), "ContentView has no ETA string")

        print("LeaveByDisplay tests passed")
    }
}
