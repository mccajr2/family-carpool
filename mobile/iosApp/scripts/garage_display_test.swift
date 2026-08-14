import Foundation

@main
struct GarageDisplayTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        let years = GarageDisplay.yearOptions(
            now: ISO8601DateFormatter().date(from: "2026-08-14T00:00:00Z")!
        )
        expect(years.first == 2027, "year options start at next UTC year")
        expect(years.last == 1996, "year options end at 1996")

        func vehicle(_ id: String, _ label: String, keptAt: String?, owner: String = "1") -> GarageVehicleView {
            GarageVehicleView(
                id: id,
                ownerAdultId: owner,
                driverAdultIds: [owner],
                keptAtPlaceId: keptAt,
                label: label,
                year: 2019,
                make: "HONDA",
                model: "Civic",
                seats: 5,
                suggestedSeats: nil
            )
        }
        let groups = GarageDisplay.groupVehicles(
            [
                vehicle("van", "Blue van", keptAt: "p1"),
                vehicle("camry", "Camry", keptAt: "p2", owner: "g"),
                vehicle("truck", "Truck", keptAt: "p2", owner: "gp"),
                vehicle("civic", "Civic", keptAt: nil, owner: "n"),
            ],
            places: [("p1", "Mom's house"), ("p2", "Grandma's house")]
        )
        expect(
            groups.map(\.heading) == ["Mom's house", "Grandma's house", "Other"],
            "groups by kept-at then Other"
        )
        expect(groups[1].vehicles.map(\.label) == ["Camry", "Truck"], "same house does not merge owners")
        expect(
            GarageDisplay.drivenByLabel(
                vehicle("v", "Van", keptAt: nil),
                members: [
                    GarageMemberView(adultId: "1", displayName: "Mom", drives: true),
                ]
            ) == "Driven by Mom",
            "driven by uses display names"
        )

        let json = """
        {"members":[{"adultId":"1","displayName":"Mom","drives":true}],"vehicles":[]}
        """
        expect(GarageView.decode(json)?.members.first?.drives == true, "decodes garage JSON")

        let contentURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("iosApp/ContentView.swift")
        let content = try! String(contentsOf: contentURL, encoding: .utf8)
        expect(content.contains("title: \"Garage\""), "More has Garage row")
        expect(content.contains("I don’t drive"), "Garage has don't-drive toggle")
        expect(content.contains("Add vehicle"), "Garage has Add vehicle")
        expect(content.contains("Who can drive this?"), "Garage has who-can-drive")
        expect(content.contains("Seats (including driver)"), "Garage seats include driver")
        expect(!content.contains("VIN"), "Garage has no VIN field")
        expect(content.contains("case .garage:"), "More navigation includes garage")

        print("GarageDisplay tests passed")
    }
}
