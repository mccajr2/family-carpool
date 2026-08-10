import Foundation
import SharedLogic
import SwiftUI

struct FamilyKidItem: Identifiable, Equatable {
    let id: String
    var displayName: String
}

struct FamilyPlaceItem: Identifiable, Equatable {
    let id: String
    var name: String
    var address: String
    var isLocated: Bool
}

struct FamilyFeedItem: Identifiable, Equatable {
    let id: String
    var name: String
    var sourceUrl: String
    var kidIds: [String]
    var lastSyncedAt: String?
    var lastSyncError: String?
    var eventCount: Int

    var syncStatusLabel: String {
        if let lastSyncError, !lastSyncError.isEmpty {
            return "Sync failed: \(lastSyncError)"
        }
        if lastSyncedAt != nil {
            return "Synced · \(eventCount) events"
        }
        return "Not synced"
    }

    func listStatusLabel(kids: [FamilyKidItem]) -> String {
        let namesById = Dictionary(uniqueKeysWithValues: kids.map { ($0.id, $0.displayName) })
        let kidNames = kidIds.compactMap { id -> String? in
            let name = namesById[id]?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name?.isEmpty == false) ? name : nil
        }.joined(separator: ", ")
        let status = syncStatusLabel
        return kidNames.isEmpty ? status : "\(kidNames) · \(status)"
    }
}

struct FamilyManualEventItem: Identifiable, Equatable {
    let id: String
    var title: String
    var startsAt: String
    var endsAt: String?
    var location: String?
    var kidIds: [String]

    var whenLabel: String {
        if let endsAt, !endsAt.isEmpty {
            return "\(startsAt) → \(endsAt)"
        }
        return startsAt
    }

    func kidNamesLabel(kids: [FamilyKidItem]) -> String {
        let namesById = Dictionary(uniqueKeysWithValues: kids.map { ($0.id, $0.displayName) })
        return kidIds.compactMap { id -> String? in
            let name = namesById[id]?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name?.isEmpty == false) ? name : nil
        }.joined(separator: ", ")
    }
}

struct FamilyMemberItem: Identifiable, Equatable {
    var id: String { adultId }
    let adultId: String
    let email: String
    let displayName: String
    var role: String

    var label: String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? email : trimmed
    }
}

@MainActor
final class AuthViewModel: ObservableObject {
    enum Phase {
        case signedOut
        case codeSent
        case signedIn
    }

    enum FamilyPhase {
        case loading
        case choose
        case create
        case join
        case ready
    }

    @Published var email: String = ""
    @Published var code: String = ""
    @Published var phase: Phase = .signedOut
    @Published var signedInEmail: String = ""
    @Published var currentAdultId: String = ""
    @Published var hasDisplayName: Bool = false
    @Published var adultDisplayName: String = ""
    @Published var circleNameInput: String = ""
    @Published var inviteCodeInput: String = ""
    @Published var inviteCode: String = ""
    @Published var familyTitle: String = "Your family"
    @Published var familyRole: String = ""
    @Published var members: [FamilyMemberItem] = []
    @Published var kids: [FamilyKidItem] = []
    @Published var newKidName: String = ""
    @Published var places: [FamilyPlaceItem] = []
    @Published var newPlaceName: String = ""
    @Published var newPlaceAddress: String = ""
    @Published var feeds: [FamilyFeedItem] = []
    @Published var newFeedName: String = ""
    @Published var newFeedUrl: String = ""
    @Published var newFeedKidIds: [String] = []
    @Published var events: [FamilyManualEventItem] = []
    @Published var newEventTitle: String = ""
    @Published var newEventStartsAt: String = ""
    @Published var newEventEndsAt: String = ""
    @Published var newEventLocation: String = ""
    @Published var newEventKidIds: [String] = []
    @Published var editingEventId: String?
    @Published var editingEventTitle: String = ""
    @Published var editingEventStartsAt: String = ""
    @Published var editingEventEndsAt: String = ""
    @Published var editingEventLocation: String = ""
    @Published var editingEventKidIds: [String] = []
    @Published var familyPhase: FamilyPhase = .loading
    @Published var editingKidId: String?
    @Published var editingKidName: String = ""
    @Published var editingPlaceId: String?
    @Published var editingPlaceName: String = ""
    @Published var editingPlaceAddress: String = ""
    @Published var editingFeedId: String?
    @Published var editingFeedName: String = ""
    @Published var editingFeedUrl: String = ""
    @Published var editingFeedKidIds: [String] = []
    @Published var devHint: String?
    @Published var errorMessage: String?
    @Published var isLoading: Bool = false

    private let bridge: AuthBridge

    var isOrganizer: Bool { familyRole == "ORGANIZER" }

    init(bridge: AuthBridge = AuthBridge()) {
        self.bridge = bridge
        if bridge.isSignedIn() {
            phase = .signedIn
            refreshCurrentEmail()
            loadFamily()
        }
    }

    func sendCode() {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.requestCode(
            email: trimmed,
            onSuccess: { [weak self] devCode in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.phase = .codeSent
                    self.devHint = devCode
                    if let devCode, self.code.isEmpty {
                        self.code = devCode
                    }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func verifyCode() {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty, !trimmedCode.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.verifyCode(
            email: trimmedEmail,
            code: trimmedCode,
            onSuccess: { [weak self] adultEmail in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.signedInEmail = adultEmail
                    self.phase = .signedIn
                    self.devHint = nil
                    self.loadFamily()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func signOut() {
        isLoading = true
        errorMessage = nil
        bridge.logout(
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.phase = .signedOut
                    self.resetFamilyFields()
                    self.code = ""
                    self.devHint = nil
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func loadFamily() {
        familyPhase = .loading
        errorMessage = nil
        bridge.loadFamily(
            onNeedsCreate: { [weak self] email, hasDisplayName in
                Task { @MainActor in
                    guard let self else { return }
                    self.signedInEmail = email
                    self.hasDisplayName = hasDisplayName.boolValue
                    self.familyPhase = .choose
                }
            },
            onReady: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated in
                Task { @MainActor in
                    self?.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: role,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.familyPhase = .choose
                    self?.errorMessage = message
                }
            }
        )
    }

    func showCreate() {
        familyPhase = .create
        errorMessage = nil
    }

    func showJoin() {
        familyPhase = .join
        errorMessage = nil
    }

    func showChoose() {
        familyPhase = .choose
        errorMessage = nil
    }

    func createFamily() {
        let display = adultDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !display.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        let optionalName = circleNameInput.trimmingCharacters(in: .whitespacesAndNewlines)
        bridge.createFamilyCircle(
            adultDisplayName: display,
            circleName: optionalName.isEmpty ? nil : optionalName,
            onSuccess: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: role,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func joinFamily() {
        let code = inviteCodeInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        let display = adultDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !hasDisplayName && display.isEmpty { return }
        isLoading = true
        errorMessage = nil
        bridge.joinFamilyCircle(
            code: code,
            adultDisplayName: hasDisplayName ? nil : display,
            onSuccess: { [weak self] title, email, adultId, displayName, role, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: role,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func regenerateInvite() {
        isLoading = true
        errorMessage = nil
        bridge.regenerateInvite(
            onSuccess: { [weak self] code in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.inviteCode = code
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func leaveFamily() {
        isLoading = true
        errorMessage = nil
        bridge.leaveFamily(
            onSuccess: { [weak self] email, hasDisplayName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.signedInEmail = email
                    self.hasDisplayName = hasDisplayName.boolValue
                    self.kids = []
                    self.members = []
                    self.inviteCode = ""
                    self.places = []
                    self.feeds = []
                    self.events = []
                    self.familyPhase = .choose
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func promote(_ member: FamilyMemberItem) {
        updateRole(member, role: "ORGANIZER")
    }

    func demote(_ member: FamilyMemberItem) {
        updateRole(member, role: "CAREGIVER")
    }

    func removeMember(_ member: FamilyMemberItem) {
        isLoading = true
        errorMessage = nil
        bridge.removeMember(
            adultId: member.adultId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.members.removeAll { $0.adultId == member.adultId }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func addKid() {
        let name = newKidName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.addKid(
            displayName: name,
            onSuccess: { [weak self] id, kidName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.kids.append(FamilyKidItem(id: id, displayName: kidName))
                    self.newKidName = ""
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func beginRename(_ kid: FamilyKidItem) {
        editingKidId = kid.id
        editingKidName = kid.displayName
    }

    func cancelRename() {
        editingKidId = nil
        editingKidName = ""
    }

    func saveRename() {
        guard let kidId = editingKidId else { return }
        let name = editingKidName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.renameKid(
            kidId: kidId,
            displayName: name,
            onSuccess: { [weak self] id, kidName in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let index = self.kids.firstIndex(where: { $0.id == id }) {
                        self.kids[index].displayName = kidName
                    }
                    self.cancelRename()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func removeKid(_ kidId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removeKid(
            kidId: kidId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.kids.removeAll { $0.id == kidId }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    private func updateRole(_ member: FamilyMemberItem, role: String) {
        isLoading = true
        errorMessage = nil
        bridge.updateMemberRole(
            adultId: member.adultId,
            role: role,
            onSuccess: { [weak self] title, email, adultId, displayName, familyRole, inviteCode, memberAdultIds, memberEmails, memberNames, memberRoles, kidIds, kidNames, placeIds, placeNames, placeAddresses, placeLocated in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.applyReady(
                        title: title,
                        email: email,
                        adultId: adultId,
                        displayName: displayName,
                        role: familyRole,
                        inviteCode: inviteCode,
                        memberAdultIds: memberAdultIds,
                        memberEmails: memberEmails,
                        memberNames: memberNames,
                        memberRoles: memberRoles,
                        kidIds: kidIds,
                        kidNames: kidNames,
                        placeIds: placeIds,
                        placeNames: placeNames,
                        placeAddresses: placeAddresses,
                        placeLocated: placeLocated
                    )
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }


    func addPlace() {
        let name = newPlaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = newPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !address.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.addPlace(
            name: name,
            address: address,
            onSuccess: { [weak self] id, placeName, placeAddress, located in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.places.append(
                        FamilyPlaceItem(
                            id: id,
                            name: placeName,
                            address: placeAddress,
                            isLocated: located == "true"
                        )
                    )
                    self.newPlaceName = ""
                    self.newPlaceAddress = ""
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func beginEditPlace(_ place: FamilyPlaceItem) {
        editingPlaceId = place.id
        editingPlaceName = place.name
        editingPlaceAddress = place.address
    }

    func cancelEditPlace() {
        editingPlaceId = nil
        editingPlaceName = ""
        editingPlaceAddress = ""
    }

    func savePlace() {
        guard let placeId = editingPlaceId else { return }
        let name = editingPlaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = editingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !address.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.updatePlace(
            placeId: placeId,
            name: name,
            address: address,
            onSuccess: { [weak self] id, placeName, placeAddress, located in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let index = self.places.firstIndex(where: { $0.id == id }) {
                        self.places[index].name = placeName
                        self.places[index].address = placeAddress
                        self.places[index].isLocated = located == "true"
                    }
                    self.cancelEditPlace()
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func removePlace(_ placeId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removePlace(
            placeId: placeId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.places.removeAll { $0.id == placeId }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func locatePlace(_ placeId: String) {
        isLoading = true
        errorMessage = nil
        bridge.locatePlace(
            placeId: placeId,
            onSuccess: { [weak self] id, placeName, placeAddress, located in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let index = self.places.firstIndex(where: { $0.id == id }) {
                        self.places[index].name = placeName
                        self.places[index].address = placeAddress
                        self.places[index].isLocated = located == "true"
                    }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    func loadFeeds() {
        guard isOrganizer else {
            feeds = []
            return
        }
        bridge.listFeeds(
            onSuccess: { [weak self] ids, names, sourceUrls, kidIdsJoined, lastSyncedAts, lastSyncErrors, eventCounts in
                Task { @MainActor in
                    guard let self else { return }
                    var next: [FamilyFeedItem] = []
                    next.reserveCapacity(ids.count)
                    for index in 0..<ids.count {
                        let kids = Self.splitJoinedIds(kidIdsJoined[index])
                        next.append(
                            self.makeFeedItem(
                                id: ids[index],
                                name: names[index],
                                sourceUrl: sourceUrls[index],
                                kidIds: kids,
                                lastSyncedAt: lastSyncedAts[index],
                                lastSyncError: lastSyncErrors[index],
                                eventCount: eventCounts[index]
                            )
                        )
                    }
                    self.feeds = next
                    self.isLoading = false
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.errorMessage = message
                }
            }
        )
    }

    /// Re-GET feeds list only — does not trigger Sync now.
    func refreshFeeds() {
        guard isOrganizer else { return }
        isLoading = true
        errorMessage = nil
        loadFeeds()
    }

    func toggleNewFeedKid(_ kidId: String) {
        if let index = newFeedKidIds.firstIndex(of: kidId) {
            newFeedKidIds.remove(at: index)
        } else {
            newFeedKidIds.append(kidId)
        }
    }

    func toggleEditingFeedKid(_ kidId: String) {
        if let index = editingFeedKidIds.firstIndex(of: kidId) {
            editingFeedKidIds.remove(at: index)
        } else {
            editingFeedKidIds.append(kidId)
        }
    }

    func addFeed() {
        let name = newFeedName.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceUrl = newFeedUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isOrganizer, !name.isEmpty, !sourceUrl.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.createFeed(
            name: name,
            sourceUrl: sourceUrl,
            kidIds: newFeedKidIds,
            onSuccess: { [weak self] id, name, sourceUrl, kidIds, lastSyncedAt, lastSyncError, eventCount in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.feeds.append(
                        self.makeFeedItem(
                            id: id,
                            name: name,
                            sourceUrl: sourceUrl,
                            kidIds: kidIds,
                            lastSyncedAt: lastSyncedAt,
                            lastSyncError: lastSyncError,
                            eventCount: eventCount
                        )
                    )
                    self.newFeedName = ""
                    self.newFeedUrl = ""
                    self.newFeedKidIds = []
                }
            },
            onError: feedError
        )
    }

    func beginEditFeed(_ feed: FamilyFeedItem) {
        editingFeedId = feed.id
        editingFeedName = feed.name
        editingFeedUrl = feed.sourceUrl
        editingFeedKidIds = feed.kidIds
    }

    func cancelEditFeed() {
        editingFeedId = nil
        editingFeedName = ""
        editingFeedUrl = ""
        editingFeedKidIds = []
    }

    func saveFeed() {
        guard let feedId = editingFeedId else { return }
        let name = editingFeedName.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceUrl = editingFeedUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isOrganizer, !name.isEmpty, !sourceUrl.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.updateFeed(
            feedId: feedId, name: name, sourceUrl: sourceUrl, kidIds: editingFeedKidIds,
            onSuccess: { [weak self] id, name, sourceUrl, kidIds, lastSyncedAt, lastSyncError, eventCount in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    let item = self.makeFeedItem(
                        id: id,
                        name: name,
                        sourceUrl: sourceUrl,
                        kidIds: kidIds,
                        lastSyncedAt: lastSyncedAt,
                        lastSyncError: lastSyncError,
                        eventCount: eventCount
                    )
                    if let index = self.feeds.firstIndex(where: { $0.id == id }) {
                        self.feeds[index] = item
                    }
                    self.cancelEditFeed()
                }
            },
            onError: feedError
        )
    }

    func removeFeed(_ feedId: String) {
        guard isOrganizer else { return }
        isLoading = true
        errorMessage = nil
        bridge.deleteFeed(
            feedId: feedId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.feeds.removeAll { $0.id == feedId }
                }
            },
            onError: feedError
        )
    }

    func syncFeed(_ feedId: String) {
        guard isOrganizer else { return }
        isLoading = true
        errorMessage = nil
        bridge.syncFeed(
            feedId: feedId,
            onSuccess: { [weak self] id, name, sourceUrl, kidIds, lastSyncedAt, lastSyncError, eventCount in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    let item = self.makeFeedItem(
                        id: id,
                        name: name,
                        sourceUrl: sourceUrl,
                        kidIds: kidIds,
                        lastSyncedAt: lastSyncedAt,
                        lastSyncError: lastSyncError,
                        eventCount: eventCount
                    )
                    if let index = self.feeds.firstIndex(where: { $0.id == id }) {
                        self.feeds[index] = item
                    }
                }
            },
            onError: feedError
        )
    }

    func loadEvents() {
        isLoading = true
        errorMessage = nil
        bridge.listEvents(
            onSuccess: { [weak self] ids, titles, startsAts, endsAts, locations, kidIdsJoined in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.events = (0..<ids.count).map { index in
                        FamilyManualEventItem(
                            id: ids[index],
                            title: titles[index],
                            startsAt: startsAts[index],
                            endsAt: endsAts[index].isEmpty ? nil : endsAts[index],
                            location: locations[index].isEmpty ? nil : locations[index],
                            kidIds: Self.splitJoinedIds(kidIdsJoined[index])
                        )
                    }
                }
            },
            onError: eventError
        )
    }

    func toggleNewEventKid(_ kidId: String) {
        if let index = newEventKidIds.firstIndex(of: kidId) {
            newEventKidIds.remove(at: index)
        } else {
            newEventKidIds.append(kidId)
        }
    }

    func toggleEditingEventKid(_ kidId: String) {
        if let index = editingEventKidIds.firstIndex(of: kidId) {
            editingEventKidIds.remove(at: index)
        } else {
            editingEventKidIds.append(kidId)
        }
    }

    func addEvent() {
        let title = newEventTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let startsAt = newEventStartsAt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !startsAt.isEmpty, !newEventKidIds.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.createEvent(
            title: title,
            startsAt: startsAt,
            endsAt: newEventEndsAt.trimmingCharacters(in: .whitespacesAndNewlines),
            location: newEventLocation.trimmingCharacters(in: .whitespacesAndNewlines),
            kidIds: newEventKidIds,
            onSuccess: { [weak self] id, eventTitle, starts, ends, location, kidIds in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    self.events.append(
                        FamilyManualEventItem(
                            id: id,
                            title: eventTitle,
                            startsAt: starts,
                            endsAt: ends.isEmpty ? nil : ends,
                            location: location.isEmpty ? nil : location,
                            kidIds: kidIds
                        )
                    )
                    self.events.sort {
                        if $0.startsAt == $1.startsAt { return $0.id < $1.id }
                        return $0.startsAt < $1.startsAt
                    }
                    self.newEventTitle = ""
                    self.newEventStartsAt = ""
                    self.newEventEndsAt = ""
                    self.newEventLocation = ""
                    self.newEventKidIds = []
                }
            },
            onError: eventError
        )
    }

    func beginEditEvent(_ event: FamilyManualEventItem) {
        editingEventId = event.id
        editingEventTitle = event.title
        editingEventStartsAt = event.startsAt
        editingEventEndsAt = event.endsAt ?? ""
        editingEventLocation = event.location ?? ""
        editingEventKidIds = event.kidIds
    }

    func cancelEditEvent() {
        editingEventId = nil
        editingEventTitle = ""
        editingEventStartsAt = ""
        editingEventEndsAt = ""
        editingEventLocation = ""
        editingEventKidIds = []
    }

    func saveEvent() {
        guard let eventId = editingEventId else { return }
        let title = editingEventTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let startsAt = editingEventStartsAt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, !startsAt.isEmpty, !editingEventKidIds.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        bridge.updateEvent(
            eventId: eventId,
            title: title,
            startsAt: startsAt,
            endsAt: editingEventEndsAt.trimmingCharacters(in: .whitespacesAndNewlines),
            location: editingEventLocation.trimmingCharacters(in: .whitespacesAndNewlines),
            kidIds: editingEventKidIds,
            onSuccess: { [weak self] id, eventTitle, starts, ends, location, kidIds in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    let item = FamilyManualEventItem(
                        id: id,
                        title: eventTitle,
                        startsAt: starts,
                        endsAt: ends.isEmpty ? nil : ends,
                        location: location.isEmpty ? nil : location,
                        kidIds: kidIds
                    )
                    if let index = self.events.firstIndex(where: { $0.id == id }) {
                        self.events[index] = item
                    }
                    self.events.sort {
                        if $0.startsAt == $1.startsAt { return $0.id < $1.id }
                        return $0.startsAt < $1.startsAt
                    }
                    self.cancelEditEvent()
                }
            },
            onError: eventError
        )
    }

    func removeEvent(_ eventId: String) {
        isLoading = true
        errorMessage = nil
        bridge.removeEvent(
            eventId: eventId,
            onSuccess: { [weak self] in
                Task { @MainActor in
                    self?.isLoading = false
                    self?.events.removeAll { $0.id == eventId }
                }
            },
            onError: eventError
        )
    }

    private func makeFeedItem(
        id: String,
        name: String,
        sourceUrl: String,
        kidIds: [String],
        lastSyncedAt: String,
        lastSyncError: String,
        eventCount: String
    ) -> FamilyFeedItem {
        FamilyFeedItem(
            id: id,
            name: name,
            sourceUrl: sourceUrl,
            kidIds: kidIds,
            lastSyncedAt: lastSyncedAt.isEmpty ? nil : lastSyncedAt,
            lastSyncError: lastSyncError.isEmpty ? nil : lastSyncError,
            eventCount: Int(eventCount) ?? 0
        )
    }

    private static func splitJoinedIds(_ joined: String) -> [String] {
        joined
            .split(separator: ",", omittingEmptySubsequences: true)
            .map(String.init)
    }

    private var feedError: (String) -> Void {
        { [weak self] message in
            Task { @MainActor in
                self?.isLoading = false
                self?.errorMessage = message
            }
        }
    }

    private var eventError: (String) -> Void {
        { [weak self] message in
            Task { @MainActor in
                self?.isLoading = false
                self?.errorMessage = message
            }
        }
    }

    private func applyReady(
        title: String,
        email: String,
        adultId: String,
        displayName: String?,
        role: String,
        inviteCode: String?,
        memberAdultIds: [String],
        memberEmails: [String],
        memberNames: [String],
        memberRoles: [String],
        kidIds: [String],
        kidNames: [String],
        placeIds: [String],
        placeNames: [String],
        placeAddresses: [String],
        placeLocated: [String]
    ) {
        familyTitle = title
        signedInEmail = email
        currentAdultId = adultId
        adultDisplayName = displayName ?? ""
        hasDisplayName = !(displayName ?? "").isEmpty
        familyRole = role
        self.inviteCode = inviteCode ?? ""
        members = (0..<memberAdultIds.count).map { index in
            FamilyMemberItem(
                adultId: memberAdultIds[index],
                email: memberEmails[index],
                displayName: memberNames[index],
                role: memberRoles[index]
            )
        }
        kids = zip(kidIds, kidNames).map { FamilyKidItem(id: $0.0, displayName: $0.1) }
        places = (0..<placeIds.count).map { index in
            FamilyPlaceItem(
                id: placeIds[index],
                name: placeNames[index],
                address: placeAddresses[index],
                isLocated: placeLocated[index] == "true"
            )
        }
        feeds = []
        events = []
        familyPhase = .ready
        loadFeeds()
        loadEvents()
    }

    private func resetFamilyFields() {
        signedInEmail = ""
        currentAdultId = ""
        adultDisplayName = ""
        circleNameInput = ""
        inviteCodeInput = ""
        inviteCode = ""
        kids = []
        places = []
        feeds = []
        events = []
        newFeedName = ""
        newFeedUrl = ""
        newFeedKidIds = []
        newEventTitle = ""
        newEventStartsAt = ""
        newEventEndsAt = ""
        newEventLocation = ""
        newEventKidIds = []
        cancelEditFeed()
        cancelEditEvent()
        members = []
        familyPhase = .loading
        hasDisplayName = false
    }

    private func refreshCurrentEmail() {
        bridge.currentEmail(
            onSuccess: { [weak self] adultEmail in
                Task { @MainActor in
                    self?.signedInEmail = adultEmail
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.phase = .signedOut
                    self?.errorMessage = message
                }
            }
        )
    }
}
