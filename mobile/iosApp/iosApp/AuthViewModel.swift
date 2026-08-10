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
            onSuccess: { [weak self] ids, names, sourceUrls, kidIds, lastSyncedAts, lastSyncErrors, eventCounts in
                Task { @MainActor in
                    self?.feeds = (0..<ids.count).map { index in
                        FamilyFeedItem(
                            id: ids[index],
                            name: names[index],
                            sourceUrl: sourceUrls[index],
                            kidIds: kidIds[index],
                            lastSyncedAt: lastSyncedAts[index],
                            lastSyncError: lastSyncErrors[index],
                            eventCount: eventCounts[index]
                        )
                    }
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in self?.errorMessage = message }
            }
        )
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
                    self.feeds.append(FamilyFeedItem(id: id, name: name, sourceUrl: sourceUrl, kidIds: kidIds, lastSyncedAt: lastSyncedAt, lastSyncError: lastSyncError, eventCount: eventCount))
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
                    if let index = self.feeds.firstIndex(where: { $0.id == id }) {
                        self.feeds[index] = FamilyFeedItem(id: id, name: name, sourceUrl: sourceUrl, kidIds: kidIds, lastSyncedAt: lastSyncedAt, lastSyncError: lastSyncError, eventCount: eventCount)
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
                    if let index = self.feeds.firstIndex(where: { $0.id == id }) {
                        self.feeds[index] = FamilyFeedItem(id: id, name: name, sourceUrl: sourceUrl, kidIds: kidIds, lastSyncedAt: lastSyncedAt, lastSyncError: lastSyncError, eventCount: eventCount)
                    }
                }
            },
            onError: feedError
        )
    }

    private var feedError: (String) -> Void {
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
        familyPhase = .ready
        loadFeeds()
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
        newFeedName = ""
        newFeedUrl = ""
        newFeedKidIds = []
        cancelEditFeed()
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
