import Foundation

/// Agenda conflict copy — mirrors web `conflictDisplay.ts` / sharedUI `ConflictDisplay.kt`.
enum ConflictDisplay {
    static func formatConflictLine(
        _ conflict: FamilyCalendarConflict,
        kids: [(id: String, displayName: String)] = []
    ) -> String {
        let peer = conflict.otherTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let peerLabel = peer.isEmpty ? "another event" : peer
        if conflict.type.uppercased() == "KID_TIME_OVERLAP" {
            if let kidId = conflict.kidId,
               let name = kids.first(where: { $0.id == kidId })?
                .displayName.trimmingCharacters(in: .whitespacesAndNewlines),
               !name.isEmpty
            {
                return "\(name) overlaps \(peerLabel)"
            }
            return "Kid schedule overlaps \(peerLabel)"
        }
        if let name = conflict.adultDisplayName?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !name.isEmpty
        {
            return "\(name) also covering \(peerLabel)"
        }
        let adult = conflict.adultId != nil ? "This adult" : "Adult"
        return "\(adult) also covering \(peerLabel)"
    }

    static func conflictDisplayLines(
        _ conflicts: [FamilyCalendarConflict],
        kids: [(id: String, displayName: String)] = []
    ) -> [String] {
        var seen = Set<String>()
        var lines: [String] = []
        for conflict in conflicts {
            let key =
                "\(conflict.type):\(conflict.otherSource):\(conflict.otherItemId):" +
                "\(conflict.kidId ?? ""):\(conflict.adultId ?? "")"
            if seen.contains(key) { continue }
            seen.insert(key)
            lines.append(formatConflictLine(conflict, kids: kids))
        }
        return lines
    }

    static func coverageDoubleBookMessage(_ message: String) -> String {
        let lower = message.lowercased()
        if lower.contains("overlapping"), lower.contains("confirmed") {
            return "Already confirmed on an overlapping event — decline or reassign first."
        }
        return message
    }
}
