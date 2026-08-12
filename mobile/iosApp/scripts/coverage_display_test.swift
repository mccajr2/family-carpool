import Foundation

@main
struct CoverageDisplayTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        expect(
            CoverageDisplay.coverageStatusLabel("PENDING") == "Pending",
            "PENDING label"
        )
        expect(
            CoverageDisplay.coverageStatusLabel("CONFIRMED") == "Confirmed",
            "CONFIRMED label"
        )
        expect(
            CoverageDisplay.coverageStatusLabel("DECLINED") == "Declined",
            "DECLINED label"
        )

        expect(
            CoverageDisplay.memberLabel(displayName: "Sam", email: "sam@example.com") == "Sam",
            "member label prefers display name"
        )
        expect(
            CoverageDisplay.memberLabel(displayName: "  ", email: "sam@example.com")
                == "sam@example.com",
            "member label falls back to email"
        )

        let coverage = FamilyCoverageAssignment(
            id: "a1",
            coveringAdultId: "2",
            coveringAdultDisplayName: nil,
            assignedByAdultId: "1",
            kidIds: ["k1", "k2"],
            status: "PENDING"
        )
        let members: [(adultId: String, displayName: String, email: String)] = [
            ("2", "Sam", "sam@example.com"),
        ]
        let kids: [(id: String, displayName: String)] = [
            ("k1", "Alex"),
            ("k2", "Jordan"),
        ]
        expect(
            CoverageDisplay.coverageAdultLabel(coverage, members: members) == "Sam",
            "adult label from members"
        )
        expect(
            CoverageDisplay.coverageKidNames(coverage, kids: kids) == "Alex, Jordan",
            "kid names joined"
        )

        let coverages = [
            FamilyCoverageAssignment(
                id: "a1",
                coveringAdultId: "1",
                coveringAdultDisplayName: nil,
                assignedByAdultId: "1",
                kidIds: ["k1"],
                status: "CONFIRMED"
            ),
            FamilyCoverageAssignment(
                id: "a2",
                coveringAdultId: "2",
                coveringAdultDisplayName: nil,
                assignedByAdultId: "1",
                kidIds: ["k2"],
                status: "DECLINED"
            ),
            FamilyCoverageAssignment(
                id: "a3",
                coveringAdultId: "2",
                coveringAdultDisplayName: nil,
                assignedByAdultId: "1",
                kidIds: ["k3"],
                status: "PENDING"
            ),
        ]
        let active = CoverageDisplay.activeCoverages(coverages)
        expect(active.count == 2, "active excludes declined")
        expect(active.map(\.id) == ["a1", "a3"], "active ids")
        expect(
            CoverageDisplay.pendingCoverageForAdult(coverages, adultId: "2")?.id == "a3",
            "pending for adult 2"
        )
        expect(
            CoverageDisplay.pendingCoverageForAdult(coverages, adultId: "1") == nil,
            "no pending for adult 1"
        )

        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(content.contains("Needs coverage"), "Agenda shows Needs coverage")
        expect(content.contains("Assign coverage"), "Agenda shows Assign coverage")
        expect(content.contains("Confirm coverage"), "Agenda shows Confirm coverage")
        expect(content.contains("My default leave-from"), "Places shows default leave-from")

        print("CoverageDisplay tests passed")
    }
}
