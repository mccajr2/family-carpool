import Foundation

struct CarpoolFeedStatusView: Codable, Equatable, Identifiable {
    var id: String { feedId }
    let feedId: String
    let feedName: String
    let status: String
    let spaceId: String?
    let spaceName: String?
}

struct CarpoolSpaceMemberView: Codable, Equatable, Identifiable {
    var id: String { circleId }
    let circleId: String
    let circleName: String?
    let membership: String
}

struct CarpoolJoinRequestView: Codable, Equatable, Identifiable {
    let id: String
    let spaceId: String
    let circleId: String
    let circleName: String?
    let requestedByAdultId: String
    let requestedByDisplayName: String?
}

struct CarpoolSpaceView: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let membership: String
    let inviteCode: String
    let callerFeedId: String?
    let members: [CarpoolSpaceMemberView]
    let pendingRequests: [CarpoolJoinRequestView]
}

struct CarpoolSummaryView: Codable, Equatable {
    let circleRole: String
    let feeds: [CarpoolFeedStatusView]
    let spaces: [CarpoolSpaceView]

    static func decode(_ json: String) -> CarpoolSummaryView? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(CarpoolSummaryView.self, from: data)
    }

    var hasNoCarpools: Bool { feeds.isEmpty && spaces.isEmpty }
}

enum CarpoolPrimaryAction: Equatable {
    case enable
    case request
    case open
    case none
}

enum CarpoolDisplay {
    static func circleDisplayName(_ name: String?) -> String {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "Your family" : trimmed
    }

    static func feedStatusLabel(_ status: String) -> String {
        switch status {
        case "NONE": return "No carpool"
        case "AVAILABLE": return "Carpool available"
        case "REQUESTED": return "Requested"
        case "MEMBER": return "Member"
        case "OWNER": return "Owned"
        default: return status
        }
    }

    static func enableConfirmMessage(feedName: String) -> String {
        "This family will own the carpool for \(feedName) and will admit or decline join requests. Enable carpool?"
    }

    static func emptyHint(circleRole: String) -> String {
        if circleRole == "ORGANIZER" {
            return "Add a team calendar in Feeds, or paste an invite code."
        }
        return "Paste an invite code to join a team carpool."
    }

    static func joinRequestLabel(_ request: CarpoolJoinRequestView) -> String {
        let circle = circleDisplayName(request.circleName)
        let by = request.requestedByDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return by.isEmpty ? circle : "\(circle) · requested by \(by)"
    }

    static func primaryAction(status: String, spaceId: String?, isOrganizer: Bool) -> CarpoolPrimaryAction {
        if status == "NONE" && isOrganizer { return .enable }
        if status == "AVAILABLE", let spaceId, !spaceId.isEmpty { return .request }
        if (status == "MEMBER" || status == "OWNER"), let spaceId, !spaceId.isEmpty { return .open }
        return .none
    }
}
