import Foundation

struct FamilyCoverageAssignment: Identifiable, Equatable, Codable {
    let id: String
    let coveringAdultId: String
    var coveringAdultDisplayName: String?
    let assignedByAdultId: String
    var kidIds: [String]
    var status: String
}

/// Agenda coverage copy / filter helpers (mirrors sharedUI CoverageDisplay.kt).
enum CoverageDisplay {
    static func coverageStatusLabel(_ status: String) -> String {
        switch status.uppercased() {
        case "PENDING":
            return "Pending"
        case "CONFIRMED":
            return "Confirmed"
        case "DECLINED":
            return "Declined"
        default:
            return status
        }
    }

    static func memberLabel(displayName: String, email: String) -> String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? email : trimmed
    }

    static func coverageAdultLabel(
        coveringAdultDisplayName: String?,
        coveringAdultId: String,
        members: [(adultId: String, displayName: String, email: String)]
    ) -> String {
        if let name = coveringAdultDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !name.isEmpty
        {
            return name
        }
        if let member = members.first(where: { $0.adultId == coveringAdultId }) {
            return memberLabel(displayName: member.displayName, email: member.email)
        }
        return "Adult"
    }

    static func coverageAdultLabel(
        _ coverage: FamilyCoverageAssignment,
        members: [(adultId: String, displayName: String, email: String)]
    ) -> String {
        coverageAdultLabel(
            coveringAdultDisplayName: coverage.coveringAdultDisplayName,
            coveringAdultId: coverage.coveringAdultId,
            members: members
        )
    }

    static func eventKidNames(
        kidIds: [String],
        kids: [(id: String, displayName: String)]
    ) -> String {
        let namesById = Dictionary(uniqueKeysWithValues: kids.map { ($0.id, $0.displayName) })
        return kidIds.compactMap { id -> String? in
            let name = namesById[id]?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name?.isEmpty == false) ? name : nil
        }.joined(separator: ", ")
    }

    static func coverageKidNames(
        _ coverage: FamilyCoverageAssignment,
        kids: [(id: String, displayName: String)]
    ) -> String {
        eventKidNames(kidIds: coverage.kidIds, kids: kids)
    }

    static func activeCoverages(
        _ coverages: [FamilyCoverageAssignment]
    ) -> [FamilyCoverageAssignment] {
        coverages.filter { $0.status == "PENDING" || $0.status == "CONFIRMED" }
    }

    static func pendingCoverageForAdult(
        _ coverages: [FamilyCoverageAssignment],
        adultId: String
    ) -> FamilyCoverageAssignment? {
        activeCoverages(coverages).first {
            $0.status == "PENDING" && $0.coveringAdultId == adultId
        }
    }

    static func defaultCoverageAdultId(
        currentAdultId: String,
        memberAdultIds: [String]
    ) -> String {
        if memberAdultIds.count == 1 {
            return memberAdultIds[0]
        }
        if memberAdultIds.contains(currentAdultId) {
            return currentAdultId
        }
        return memberAdultIds.first ?? ""
    }

    static func defaultCoverageKidIds(_ uncoveredKidIds: [String]) -> Set<String> {
        uncoveredKidIds.count == 1 ? Set(uncoveredKidIds) : []
    }
}
