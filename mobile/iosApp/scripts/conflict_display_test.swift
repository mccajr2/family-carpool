import Foundation

@main
struct ConflictDisplayTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        let kidConflict = FamilyCalendarConflict(
            type: "KID_TIME_OVERLAP",
            kidId: "k1",
            adultId: nil,
            adultDisplayName: nil,
            otherSource: "MANUAL",
            otherItemId: "e2",
            otherTitle: "Game",
            otherStartsAt: "2026-08-15T17:30:00Z"
        )
        let adultConflict = FamilyCalendarConflict(
            type: "ADULT_COVERAGE_OVERLAP",
            kidId: nil,
            adultId: "a1",
            adultDisplayName: "Jordan",
            otherSource: "FEED",
            otherItemId: "e3",
            otherTitle: "Practice",
            otherStartsAt: "2026-08-15T17:00:00Z"
        )

        expect(
            ConflictDisplay.formatConflictLine(
                kidConflict,
                kids: [("k1", "Sam")]
            ) == "Sam overlaps Game",
            "kid name in conflict line"
        )
        expect(
            ConflictDisplay.formatConflictLine(kidConflict) == "Kid schedule overlaps Game",
            "kid conflict fallback"
        )
        expect(
            ConflictDisplay.formatConflictLine(adultConflict) == "Jordan also covering Practice",
            "adult conflict line"
        )
        expect(
            ConflictDisplay.conflictDisplayLines([kidConflict, kidConflict]) == [
                "Kid schedule overlaps Game"
            ],
            "dedupe conflict lines"
        )
        expect(
            ConflictDisplay.coverageDoubleBookMessage(
                "Adult is already confirmed on an overlapping calendar item"
            ) == "Already confirmed on an overlapping event — decline or reassign first.",
            "double-book 409 copy"
        )
        expect(
            ConflictDisplay.coverageDoubleBookMessage(
                "Kid is already covered on this calendar item"
            ) == "Kid is already covered on this calendar item",
            "pass through unrelated 409"
        )

        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(
            content.contains("ConflictDisplay.conflictDisplayLines"),
            "Agenda renders conflict lines from ConflictDisplay"
        )
        expect(
            content.contains("agenda-conflicts-"),
            "Agenda conflict accessibility id prefix"
        )
        expect(
            content.contains("0xB4 / 255"),
            "Agenda uses provisional amber warning color"
        )

        let authViewModelURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/AuthViewModel.swift")
        let auth = try! String(contentsOf: authViewModelURL, encoding: .utf8)
        expect(
            auth.contains("ConflictDisplay.coverageDoubleBookMessage"),
            "confirm/assign 409 uses ConflictDisplay double-book copy"
        )
        expect(
            auth.contains("coverageActionErrors"),
            "409 maps to per-item coverageActionErrors"
        )
        expect(auth.contains("conflictsJson"), "bridge maps conflictsJson")
        expect(
            content.contains("coverageActionError"),
            "Agenda coverage section renders coverageActionError near CTAs"
        )
        expect(
            content.contains("agenda-coverage-error-"),
            "Agenda coverage error accessibility id prefix"
        )

        print("ConflictDisplay tests passed")
    }
}
