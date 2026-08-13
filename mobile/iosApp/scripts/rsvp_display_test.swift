import Foundation

@main
struct RsvpDisplayTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        expect(RsvpDisplay.statusLabel("YES") == "Yes", "YES label")
        expect(RsvpDisplay.statusLabel("NO") == "No", "NO label")
        expect(RsvpDisplay.statusLabel("NO_RESPONSE") == "No response", "NO_RESPONSE label")

        let emptyRsvps = FamilyCalendarItem(
            id: "e1",
            source: "MANUAL",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00Z",
            endsAt: nil,
            location: nil,
            kidIds: ["k1"],
            feedId: nil,
            feedName: nil,
            leaveFromPlaceId: nil,
            leaveFromPlaceName: nil,
            leaveByAt: nil,
            leaveByStatus: "UNAVAILABLE",
            leaveByReason: nil,
            coverages: [],
            uncoveredKidIds: ["k1"],
            conflicts: [],
            rsvps: []
        )
        expect(
            RsvpDisplay.statusForKid(item: emptyRsvps, kidId: "k1") == "NO_RESPONSE",
            "missing row defaults to NO_RESPONSE"
        )

        let allNo = FamilyCalendarItem(
            id: "e1",
            source: "MANUAL",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00Z",
            endsAt: nil,
            location: nil,
            kidIds: ["k1", "k2"],
            feedId: nil,
            feedName: nil,
            leaveFromPlaceId: nil,
            leaveFromPlaceName: nil,
            leaveByAt: nil,
            leaveByStatus: "UNAVAILABLE",
            leaveByReason: nil,
            coverages: [],
            uncoveredKidIds: [],
            conflicts: [],
            rsvps: [
                FamilyCalendarRsvp(kidId: "k1", status: "NO"),
                FamilyCalendarRsvp(kidId: "k2", status: "NO"),
            ]
        )
        expect(RsvpDisplay.isAgendaItemOutOfPlay(allNo), "all No is out of play")

        let mixed = FamilyCalendarItem(
            id: "e1",
            source: "MANUAL",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00Z",
            endsAt: nil,
            location: nil,
            kidIds: ["k1", "k2"],
            feedId: nil,
            feedName: nil,
            leaveFromPlaceId: nil,
            leaveFromPlaceName: nil,
            leaveByAt: nil,
            leaveByStatus: "UNAVAILABLE",
            leaveByReason: nil,
            coverages: [
                FamilyCoverageAssignment(
                    id: "a1",
                    coveringAdultId: "1",
                    coveringAdultDisplayName: nil,
                    assignedByAdultId: "1",
                    kidIds: ["k1"],
                    status: "PENDING"
                ),
            ],
            uncoveredKidIds: ["k2"],
            conflicts: [],
            rsvps: [
                FamilyCalendarRsvp(kidId: "k1", status: "YES"),
                FamilyCalendarRsvp(kidId: "k2", status: "NO"),
            ]
        )
        expect(!RsvpDisplay.isAgendaItemOutOfPlay(mixed), "mixed stays in play")
        expect(
            RsvpDisplay.kidHasActiveCoverage(item: mixed, kidId: "k1"),
            "pending coverage counts as active"
        )
        expect(
            RsvpDisplay.coverageReleaseMessage(kidName: "Emma")
                == "This will remove coverage for Emma.",
            "release confirm copy"
        )

        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(content.contains("RsvpDisplay.isAgendaItemOutOfPlay"), "out-of-play chrome")
        expect(content.contains("requestRsvpChange"), "RSVP change helper")
        expect(content.contains("AgendaBands.manualActions"), "manual Edit/Remove band")
        expect(content.contains("coverageReleaseMessage"), "coverage release confirm")
        expect(
            content.contains("accessibilityIdentifier(\"rsvp-"),
            "per-kid RSVP accessibility id"
        )

        if let primaryRange = content.range(of: "AgendaBands.primary"),
           let travelRange = content.range(of: "AgendaBands.travel"),
           let peopleRange = content.range(of: "AgendaBands.people"),
           let coverageRange = content.range(of: "AgendaBands.coverage"),
           let manualRange = content.range(of: "AgendaBands.manualActions")
        {
            expect(
                primaryRange.lowerBound < travelRange.lowerBound
                    && travelRange.lowerBound < peopleRange.lowerBound
                    && peopleRange.lowerBound < coverageRange.lowerBound
                    && coverageRange.lowerBound < manualRange.lowerBound,
                "Agenda bands Primary → Travel → People → Coverage → Manual actions"
            )
        } else {
            expect(false, "all AgendaBands identifiers must be present for order assert")
        }

        let authURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/AuthViewModel.swift")
        let auth = try! String(contentsOf: authURL, encoding: .utf8)
        expect(auth.contains("func setCalendarRsvp("), "AuthViewModel sets RSVP")
        expect(auth.contains("rsvpsJson"), "bridge threads rsvpsJson")

        print("RsvpDisplay tests passed")
    }
}
