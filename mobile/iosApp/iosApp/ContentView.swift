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
                            HStack {
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
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
