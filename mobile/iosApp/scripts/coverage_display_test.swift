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

        let memberAdultIds = ["2", "1"]
        expect(
            CoverageDisplay.defaultCoverageAdultId(
                currentAdultId: "1",
                memberAdultIds: memberAdultIds
            ) == "1",
            "defaults covering adult to signed-in adult"
        )
        expect(
            CoverageDisplay.defaultCoverageAdultId(
                currentAdultId: "1",
                memberAdultIds: ["9"]
            ) == "9",
            "sole circle adult is implicit"
        )
        expect(
            CoverageDisplay.defaultCoverageKidIds(["k1"]) == Set(["k1"]),
            "sole uncovered kid is auto-selected"
        )
        expect(
            CoverageDisplay.defaultCoverageKidIds(["k1", "k2"]).isEmpty,
            "multiple uncovered kids stay unselected"
        )

        let contentViewURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentViewURL, encoding: .utf8)
        expect(content.contains("Needs coverage"), "Agenda shows Needs coverage")
        expect(content.contains("Assign coverage"), "Agenda shows Assign coverage")
        expect(content.contains("Confirm coverage"), "Agenda shows Confirm coverage")
        expect(content.contains("Decline coverage"), "Agenda shows Decline coverage")
        expect(content.contains("Remove coverage"), "Agenda shows Remove coverage")
        expect(content.contains("My default leave-from"), "Places shows default leave-from")
        expect(content.contains("FieldMenuRow"), "Agenda uses FieldMenuRow for pickers")
        expect(content.contains("FieldValueRow"), "Agenda uses FieldValueRow for sole values")
        expect(content.contains("effectiveAdultId"), "Agenda uses effective covering adult")

        let fieldRowURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/FieldRow.swift")
        let fieldRow = try! String(contentsOf: fieldRowURL, encoding: .utf8)
        expect(fieldRow.contains("struct FieldMenuRow"), "FieldMenuRow helper exists")
        expect(fieldRow.contains("struct FieldValueRow"), "FieldValueRow helper exists")
        expect(fieldRow.contains("chevron.down"), "interactive field rows show chevron")
        expect(fieldRow.contains("Field rows"), "FieldRow documents contract section")

        expect(
            content.contains("CoverageDisplay.defaultCoverageAdultId"),
            "Agenda defaults covering adult via CoverageDisplay"
        )
        expect(
            content.contains("Toggling kids must not clear the covering-adult default"),
            "kid toggle preserves covering adult default"
        )
        expect(content.contains("UiTokens.Space.xl"), "Agenda uses xl section spacing")
        expect(content.contains("UiTokens.Space._2xl"), "Agenda items use 2xl list gap")
        expect(content.contains("UiTokens.Space.md"), "Agenda list has md top padding")
        if let destRange = content.range(of: "private var calendarDestination"),
           let itemRange = content.range(
            of: "private func agendaItemRow",
            range: destRange.upperBound..<content.endIndex
           )
        {
            let body = content[destRange.lowerBound..<itemRange.lowerBound]
            expect(
                body.contains("VStack(alignment: .leading, spacing: UiTokens.Space.xl)"),
                "Agenda destination spaces heading/filters/list with xl"
            )
        } else {
            expect(false, "calendarDestination body must be findable for spacing assert")
        }
        expect(content.contains("\"Saving…\""), "compose Save uses Saving… while busy")
        expect(content.contains("\"Loading…\""), "Load more uses Loading… while busy")
        expect(
            content.contains("agendaListBusy"),
            "Agenda empty copy suppressed while list is busy"
        )
        expect(
            content.contains("No events in the loaded window."),
            "Agenda keeps empty-window copy for idle empty"
        )
        expect(
            !content.contains("Working…"),
            "Sign out must never become Working…"
        )

        let authViewModelURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/AuthViewModel.swift")
        let auth = try! String(contentsOf: authViewModelURL, encoding: .utf8)
        expect(
            auth.contains("clearLoadingWhenDone"),
            "loadFeeds must not always clear isLoading (parallel with loadCalendar)"
        )
        expect(
            auth.contains("loadFeeds(clearLoadingWhenDone: true)"),
            "refreshFeeds owns busy clear via clearLoadingWhenDone"
        )
        expect(
            content.contains("title: \"Sign out\""),
            "More Sign out label stays Sign out"
        )
        expect(
            !content.contains("Edit location"),
            "manual destination fixes go through Edit, not Edit location"
        )
        expect(content.contains("Open Places"), "NO_ORIGIN recovery keeps Open Places")
        expect(
            content.contains("locatedPlaces.count <= 1"),
            "leave-from sole located place is label-only"
        )
        expect(content.contains("soleAdult"), "sole adult hides covering-adult picker")
        expect(content.contains("soleKid"), "sole kid hides uncovered-kid checkboxes")

        print("CoverageDisplay tests passed")
    }
}
