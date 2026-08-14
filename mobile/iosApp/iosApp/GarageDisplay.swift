import Foundation

struct GarageMemberView: Codable, Equatable, Identifiable {
    var id: String { adultId }
    let adultId: String
    let displayName: String
    let drives: Bool
}

struct GarageVehicleView: Codable, Equatable, Identifiable {
    let id: String
    let ownerAdultId: String
    let driverAdultIds: [String]
    let keptAtPlaceId: String?
    let label: String
    let year: Int
    let make: String
    let model: String
    let seats: Int
    let suggestedSeats: Int?
}

struct GarageView: Codable, Equatable {
    let members: [GarageMemberView]
    let vehicles: [GarageVehicleView]

    static func decode(_ json: String) -> GarageView? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(GarageView.self, from: data)
    }
}

struct VehicleMakeView: Codable, Equatable {
    let name: String
}

struct VehicleModelView: Codable, Equatable {
    let name: String
}

struct VehiclePlaceGroupView: Equatable {
    let placeId: String?
    let heading: String
    let vehicles: [GarageVehicleView]
}

enum GarageDisplay {
    static let minYear = 1996
    static let minSeats = 2
    static let maxSeats = 18

    static func yearOptions(now: Date = Date()) -> [Int] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let max = calendar.component(.year, from: now) + 1
        return Array(stride(from: max, through: minYear, by: -1))
    }

    static func groupVehicles(
        _ vehicles: [GarageVehicleView],
        places: [(id: String, name: String)]
    ) -> [VehiclePlaceGroupView] {
        var remaining = Dictionary(grouping: vehicles) { $0.keptAtPlaceId ?? "" }
        var groups: [VehiclePlaceGroupView] = []
        for place in places {
            guard let list = remaining.removeValue(forKey: place.id) else { continue }
            groups.append(
                VehiclePlaceGroupView(
                    placeId: place.id,
                    heading: place.name,
                    vehicles: list.sorted { $0.label < $1.label }
                )
            )
        }
        let leftover = remaining.values.flatMap { $0 }
        if !leftover.isEmpty {
            groups.append(
                VehiclePlaceGroupView(
                    placeId: nil,
                    heading: "Other",
                    vehicles: leftover.sorted { $0.label < $1.label }
                )
            )
        }
        return groups
    }

    static func drivenByLabel(
        _ vehicle: GarageVehicleView,
        members: [GarageMemberView]
    ) -> String {
        let names = vehicle.driverAdultIds.map { id in
            let name = members.first(where: { $0.adultId == id })?.displayName
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return name.isEmpty ? "Unknown" : name
        }
        return "Driven by \(names.joined(separator: ", "))"
    }
}
