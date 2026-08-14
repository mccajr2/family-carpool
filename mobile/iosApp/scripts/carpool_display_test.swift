import Foundation

@main
struct CarpoolDisplayTestMain {
    static func main() {
        func expect(_ condition: Bool, _ message: String) {
            if !condition {
                fputs("FAIL: \(message)\n", stderr)
                exit(1)
            }
        }

        expect(CarpoolDisplay.circleDisplayName(nil) == "Your family", "nil circle name")
        expect(CarpoolDisplay.circleDisplayName("  ") == "Your family", "blank circle name")
        expect(CarpoolDisplay.circleDisplayName("House A") == "House A", "named circle")
        expect(CarpoolDisplay.feedStatusLabel("NONE") == "No carpool", "NONE label")
        expect(CarpoolDisplay.feedStatusLabel("OWNER") == "Owned", "OWNER label")
        expect(
            CarpoolDisplay.enableConfirmMessage(feedName: "Soccer").contains("own the carpool for Soccer"),
            "enable confirm names the feed"
        )
        expect(
            !CarpoolDisplay.emptyHint(circleRole: "CAREGIVER").contains("Feeds"),
            "caregiver empty hint omits Feeds"
        )
        expect(
            CarpoolDisplay.emptyHint(circleRole: "ORGANIZER").contains("Feeds"),
            "organizer empty hint mentions Feeds"
        )
        expect(
            CarpoolDisplay.primaryAction(status: "NONE", spaceId: nil, isOrganizer: true) == .enable,
            "organizer enable"
        )
        expect(
            CarpoolDisplay.primaryAction(status: "NONE", spaceId: nil, isOrganizer: false) == .none,
            "caregiver hides enable"
        )
        expect(
            CarpoolDisplay.primaryAction(status: "AVAILABLE", spaceId: "s1", isOrganizer: false) == .request,
            "request when available"
        )

        let json = """
        {"circleRole":"CAREGIVER","feeds":[],"spaces":[]}
        """
        let summary = CarpoolSummaryView.decode(json)
        expect(summary?.hasNoCarpools == true, "empty summary")
        expect(summary?.circleRole == "CAREGIVER", "decodes circle role")

        print("CarpoolDisplay tests passed")
    }
}
