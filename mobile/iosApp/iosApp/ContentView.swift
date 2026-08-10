import SharedLogic
import SwiftUI

struct ContentView: View {
    @StateObject private var model = AuthViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch model.phase {
                case .signedIn:
                    familyContent
                case .signedOut, .codeSent:
                    signInContent
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var signInContent: some View {
        Text("Sign in")
            .font(.title2.bold())
        Text("Email one-time code")
            .font(.subheadline)
            .foregroundStyle(.secondary)

        TextField("Email", text: $model.email)
            .textInputAutocapitalization(.never)
            .keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .autocorrectionDisabled()
            .disabled(model.isLoading)
            .textFieldStyle(.roundedBorder)

        if model.phase == .codeSent {
            TextField("One-time code", text: $model.code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            if let devHint = model.devHint {
                Text("Dev code echo: \(devHint)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Button(model.isLoading ? "Verifying…" : "Verify code") {
                model.verifyCode()
            }
            .disabled(model.isLoading || model.code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } else {
            Button(model.isLoading ? "Sending…" : "Send code") {
                model.sendCode()
            }
            .disabled(model.isLoading || model.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }

        if model.isLoading {
            ProgressView()
        }
        if let errorMessage = model.errorMessage {
            Text(errorMessage)
                .foregroundStyle(.red)
                .font(.footnote)
        }
    }

    @ViewBuilder
    private var familyContent: some View {
        switch model.familyPhase {
        case .loading:
            Text("Your family")
                .font(.title2.bold())
            ProgressView()
        case .choose:
            Text("Your family")
                .font(.title2.bold())
            Text("Signed in as \(model.signedInEmail.isEmpty ? "…" : model.signedInEmail). Create a circle or join with an invite code.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Create family") { model.showCreate() }
                .disabled(model.isLoading)
            Button("Have an invite code?") { model.showJoin() }
                .disabled(model.isLoading)
            if let errorMessage = model.errorMessage {
                Text(errorMessage).foregroundStyle(.red).font(.footnote)
            }
            Button("Sign out") { model.signOut() }
                .disabled(model.isLoading)
        case .create:
            Text("Create your family")
                .font(.title2.bold())
            TextField("Your name", text: $model.adultDisplayName)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            TextField("Your family (optional)", text: $model.circleNameInput)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            if let errorMessage = model.errorMessage {
                Text(errorMessage).foregroundStyle(.red).font(.footnote)
            }
            Button(model.isLoading ? "Creating…" : "Create family") {
                model.createFamily()
            }
            .disabled(model.isLoading || model.adultDisplayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            Button("Back") { model.showChoose() }
                .disabled(model.isLoading)
            Button("Sign out") { model.signOut() }
                .disabled(model.isLoading)
        case .join:
            Text("Join a family")
                .font(.title2.bold())
            TextField("Invite code", text: $model.inviteCodeInput)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            if !model.hasDisplayName {
                TextField("Your name", text: $model.adultDisplayName)
                    .disabled(model.isLoading)
                    .textFieldStyle(.roundedBorder)
            }
            if let errorMessage = model.errorMessage {
                Text(errorMessage).foregroundStyle(.red).font(.footnote)
            }
            Button(model.isLoading ? "Joining…" : "Join family") {
                model.joinFamily()
            }
            .disabled(
                model.isLoading
                    || model.inviteCodeInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || (!model.hasDisplayName
                        && model.adultDisplayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            )
            Button("Back") { model.showChoose() }
                .disabled(model.isLoading)
            Button("Sign out") { model.signOut() }
                .disabled(model.isLoading)
        case .ready:
            Text(model.familyTitle)
                .font(.title2.bold())
            Text(familySubtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if model.isOrganizer, !model.inviteCode.isEmpty {
                Text("Invite code: \(model.inviteCode)")
                    .font(.body.monospaced())
                Button("Regenerate code") { model.regenerateInvite() }
                    .disabled(model.isLoading)
            }

            Text("Members")
                .font(.headline)
            ForEach(model.members) { member in
                let isSelf = member.adultId == model.currentAdultId
                Text("\(member.label) · \(member.role)\(isSelf ? " (you)" : "")")
                if model.isOrganizer, !isSelf {
                    HStack {
                        if member.role == "CAREGIVER" {
                            Button("Promote") { model.promote(member) }
                                .disabled(model.isLoading)
                        } else {
                            Button("Demote") { model.demote(member) }
                                .disabled(model.isLoading)
                        }
                        Button("Remove") { model.removeMember(member) }
                            .disabled(model.isLoading)
                    }
                }
            }

            if model.kids.isEmpty {
                Text("No kids yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.kids) { kid in
                    if model.isOrganizer, model.editingKidId == kid.id {
                        TextField("Rename", text: $model.editingKidName)
                            .textFieldStyle(.roundedBorder)
                        HStack {
                            Button("Save") { model.saveRename() }
                                .disabled(model.isLoading || model.editingKidName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            Button("Cancel") { model.cancelRename() }
                                .disabled(model.isLoading)
                        }
                    } else {
                        HStack {
                            Text(kid.displayName)
                            Spacer()
                            if model.isOrganizer {
                                Button("Rename") { model.beginRename(kid) }
                                    .disabled(model.isLoading)
                                Button("Remove") { model.removeKid(kid.id) }
                                    .disabled(model.isLoading)
                            }
                        }
                    }
                }
            }

            if model.isOrganizer {
                TextField("New kid name", text: $model.newKidName)
                    .disabled(model.isLoading)
                    .textFieldStyle(.roundedBorder)
                Button("Add kid") {
                    model.addKid()
                }
                .disabled(model.isLoading || model.newKidName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Text("Places")
                .font(.headline)
            if model.places.isEmpty {
                Text("No places yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.places) { place in
                    if model.editingPlaceId == place.id {
                        TextField("Place name", text: $model.editingPlaceName)
                            .textFieldStyle(.roundedBorder)
                        TextField("Address", text: $model.editingPlaceAddress)
                            .textFieldStyle(.roundedBorder)
                        HStack {
                            Button("Save") { model.savePlace() }
                                .disabled(
                                    model.isLoading
                                        || model.editingPlaceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                        || model.editingPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                )
                            Button("Cancel") { model.cancelEditPlace() }
                                .disabled(model.isLoading)
                        }
                    } else {
                        VStack(alignment: .leading) {
                            Text(place.name)
                            Text(place.address)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                            Text(place.isLocated ? "Located" : "Not located")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack {
                                if !place.isLocated {
                                    Button("Retry locate") { model.locatePlace(place.id) }
                                        .disabled(model.isLoading)
                                }
                                Button("Edit") { model.beginEditPlace(place) }
                                    .disabled(model.isLoading)
                                Button("Remove place") { model.removePlace(place.id) }
                                    .disabled(model.isLoading)
                            }
                        }
                    }
                }
            }

            TextField("New place name", text: $model.newPlaceName)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            TextField("New place address", text: $model.newPlaceAddress)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            Button("Add place") {
                model.addPlace()
            }
            .disabled(
                model.isLoading
                    || model.newPlaceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || model.newPlaceAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            )

            Text("Manual events")
                .font(.headline)
            if let errorMessage = model.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.footnote)
            }
            if model.events.isEmpty {
                Text("No manual events yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.events) { event in
                    if model.editingEventId == event.id {
                        TextField("Title", text: $model.editingEventTitle)
                            .disabled(model.isLoading)
                            .textFieldStyle(.roundedBorder)
                        DatePicker(
                            "Starts at",
                            selection: $model.editingEventStartsAtDate,
                            in: Date()...,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .disabled(model.isLoading)
                        Toggle("Ends at", isOn: $model.editingEventHasEndsAt)
                            .disabled(model.isLoading)
                        if model.editingEventHasEndsAt {
                            DatePicker(
                                "Ends at",
                                selection: $model.editingEventEndsAtDate,
                                in: model.editingEventStartsAtDate...,
                                displayedComponents: [.date, .hourAndMinute]
                            )
                            .disabled(model.isLoading)
                        }
                        TextField("Location (optional)", text: $model.editingEventLocation)
                            .disabled(model.isLoading)
                            .textFieldStyle(.roundedBorder)
                        feedKidToggles(selectedKidIds: model.editingEventKidIds) { kidId in
                            model.toggleEditingEventKid(kidId)
                        }
                        HStack {
                            Button("Save") { model.saveEvent() }
                                .disabled(
                                    model.isLoading
                                        || model.editingEventTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                        || model.editingEventKidIds.isEmpty
                                )
                            Button("Cancel") { model.cancelEditEvent() }
                                .disabled(model.isLoading)
                        }
                    } else {
                        VStack(alignment: .leading) {
                            Text(event.title)
                            Text(event.whenLabel)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                            if let location = event.location, !location.isEmpty {
                                Text(location)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            let kidsLabel = event.kidNamesLabel(kids: model.kids)
                            if !kidsLabel.isEmpty {
                                Text(kidsLabel)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            HStack {
                                Button("Edit") { model.beginEditEvent(event) }
                                    .disabled(model.isLoading)
                                Button("Remove event") { model.removeEvent(event.id) }
                                    .disabled(model.isLoading)
                            }
                        }
                    }
                }
            }

            TextField("New event title", text: $model.newEventTitle)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            DatePicker(
                "Starts at",
                selection: $model.newEventStartsAtDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .disabled(model.isLoading)
            Toggle("Ends at", isOn: $model.newEventHasEndsAt)
                .disabled(model.isLoading)
            if model.newEventHasEndsAt {
                DatePicker(
                    "Ends at",
                    selection: $model.newEventEndsAtDate,
                    in: model.newEventStartsAtDate...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .disabled(model.isLoading)
            }
            TextField("Location (optional)", text: $model.newEventLocation)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            if model.kids.isEmpty {
                Text("Add a kid before creating a manual event.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                feedKidToggles(selectedKidIds: model.newEventKidIds) { kidId in
                    model.toggleNewEventKid(kidId)
                }
            }
            Button("Add event") { model.addEvent() }
                .disabled(
                    model.isLoading
                        || model.newEventTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        || model.newEventKidIds.isEmpty
                )

            if model.isOrganizer {
                HStack {
                    Text("Activity feeds")
                        .font(.headline)
                    Spacer()
                    Button("Refresh") { model.refreshFeeds() }
                        .disabled(model.isLoading)
                }
                if model.feeds.isEmpty {
                    Text("No feeds yet.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(model.feeds) { feed in
                        if model.editingFeedId == feed.id {
                            TextField("Feed name", text: $model.editingFeedName)
                                .disabled(model.isLoading)
                                .textFieldStyle(.roundedBorder)
                            TextField("Feed URL", text: $model.editingFeedUrl)
                                .disabled(model.isLoading)
                                .textFieldStyle(.roundedBorder)
                            feedKidToggles(selectedKidIds: model.editingFeedKidIds) { kidId in
                                model.toggleEditingFeedKid(kidId)
                            }
                            HStack {
                                Button("Save") { model.saveFeed() }
                                    .disabled(
                                        model.isLoading
                                            || model.editingFeedName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                            || model.editingFeedUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    )
                                Button("Cancel") { model.cancelEditFeed() }
                                    .disabled(model.isLoading)
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(feed.name)
                                    .lineLimit(1)
                                Text(feed.listStatusLabel(kids: model.kids))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                                ViewThatFits(in: .horizontal) {
                                    HStack {
                                        Button("Sync now") { model.syncFeed(feed.id) }
                                            .disabled(model.isLoading)
                                        Button("Edit") { model.beginEditFeed(feed) }
                                            .disabled(model.isLoading)
                                        Button("Remove") { model.removeFeed(feed.id) }
                                            .disabled(model.isLoading)
                                    }
                                    VStack(alignment: .leading) {
                                        Button("Sync now") { model.syncFeed(feed.id) }
                                            .disabled(model.isLoading)
                                        Button("Edit") { model.beginEditFeed(feed) }
                                            .disabled(model.isLoading)
                                        Button("Remove") { model.removeFeed(feed.id) }
                                            .disabled(model.isLoading)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                TextField("New feed name", text: $model.newFeedName)
                    .disabled(model.isLoading)
                    .textFieldStyle(.roundedBorder)
                TextField("Feed URL", text: $model.newFeedUrl)
                    .disabled(model.isLoading)
                    .textFieldStyle(.roundedBorder)
                feedKidToggles(selectedKidIds: model.newFeedKidIds) { kidId in
                    model.toggleNewFeedKid(kidId)
                }
                Button("Add feed") { model.addFeed() }
                    .disabled(
                        model.isLoading
                            || model.newFeedName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || model.newFeedUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )
            }

            if let errorMessage = model.errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.footnote)
            }
            if model.isLoading {
                ProgressView()
            }
            Button("Leave family") {
                model.leaveFamily()
            }
            .disabled(model.isLoading)
            Button(model.isLoading ? "Working…" : "Sign out") {
                model.signOut()
            }
            .disabled(model.isLoading)
        }
    }

    private var familySubtitle: String {
        var parts: [String] = []
        if !model.adultDisplayName.isEmpty {
            parts.append(model.adultDisplayName)
        }
        if !model.signedInEmail.isEmpty {
            parts.append(model.signedInEmail)
        }
        if !model.familyRole.isEmpty {
            parts.append(model.familyRole)
        }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func feedKidToggles(
        selectedKidIds: [String],
        onToggle: @escaping (String) -> Void
    ) -> some View {
        ForEach(model.kids) { kid in
            Toggle(
                kid.displayName,
                isOn: Binding(
                    get: { selectedKidIds.contains(kid.id) },
                    set: { _ in onToggle(kid.id) }
                )
            )
            .disabled(model.isLoading)
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
