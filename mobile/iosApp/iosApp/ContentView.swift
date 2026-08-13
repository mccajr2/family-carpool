import SharedLogic
import SwiftUI

struct ContentView: View {
    @StateObject private var model = AuthViewModel()
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            switch model.phase {
            case .signedIn:
                familyContent
            case .signedOut, .codeSent:
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        signInContent
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
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
        case .ready:
            readyShell
        case .loading, .loadFailed, .choose, .create, .join:
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    membershipContent
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var membershipContent: some View {
        switch model.familyPhase {
        case .loading:
            Text("Your family")
                .font(.title2.bold())
            ProgressView()
        case .loadFailed:
            Text("Your family")
                .font(.title2.bold())
            Text("Could not load your family.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let errorMessage = model.errorMessage {
                Text(errorMessage).foregroundStyle(.red).font(.footnote)
            }
            Button("Retry") { model.loadFamily() }
                .disabled(model.isLoading)
            Button("Sign out") { model.signOut() }
                .disabled(model.isLoading)
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
            EmptyView()
        }
    }

    private var readyShell: some View {
        TabView(selection: Binding(
            get: { model.shell.tab },
            set: { model.selectShellTab($0) }
        )) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: UiTokens.Space.xl) {
                        calendarDestination
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .navigationTitle(AppShellTab.calendar.title)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Add") { model.openCreateEventCompose() }
                            .disabled(model.isLoading)
                            .accessibilityLabel("Add event")
                    }
                }
                .sheet(
                    isPresented: Binding(
                        get: { model.eventCompose.isOpen },
                        set: { open in
                            if !open {
                                model.closeEventCompose()
                            }
                        }
                    )
                ) {
                    NavigationStack {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 16) {
                                eventComposeDestination
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .navigationTitle(model.eventCompose.isEditing ? "Edit event" : "Add event")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Cancel") { model.closeEventCompose() }
                                    .disabled(model.isLoading)
                            }
                        }
                    }
                }
            }
            .tabItem { Label(AppShellTab.calendar.title, systemImage: AppShellTab.calendar.systemImage) }
            .tag(AppShellTab.calendar)

            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Carpool")
                        .font(.title2.bold())
                    Text("Coming soon")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .tabItem { Label(AppShellTab.carpool.title, systemImage: AppShellTab.carpool.systemImage) }
            .tag(AppShellTab.carpool)

            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        familyDestination
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .tabItem { Label(AppShellTab.family.title, systemImage: AppShellTab.family.systemImage) }
            .tag(AppShellTab.family)

            NavigationStack(path: Binding(
                get: { model.shell.morePath },
                set: { newPath in
                    var next = model.shell
                    next.morePath = newPath
                    model.shell = next
                }
            )) {
                ScrollView {
                    VStack(alignment: .leading, spacing: UiTokens.Space.lg) {
                        moreListDestination
                    }
                    .padding(UiTokens.Space.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(FcTheme.surface(colorScheme))
                .navigationTitle("More")
                .navigationDestination(for: MoreDestination.self) { destination in
                    ScrollView {
                        VStack(alignment: .leading, spacing: UiTokens.Space.lg) {
                            switch destination {
                            case .places:
                                Text("Places")
                                    .font(.title2.bold())
                                    .foregroundStyle(FcTheme.textPrimary(colorScheme))
                                placesDestination
                            case .feeds:
                                Text("Feeds")
                                    .font(.title2.bold())
                                    .foregroundStyle(FcTheme.textPrimary(colorScheme))
                                feedsDestination
                            }
                        }
                        .padding(UiTokens.Space.lg)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .background(FcTheme.surface(colorScheme))
                    .navigationTitle(destination.title)
                    .navigationBarTitleDisplayMode(.inline)
                }
            }
            .tabItem { Label(AppShellTab.more.title, systemImage: AppShellTab.more.systemImage) }
            .tag(AppShellTab.more)
        }
    }

    @ViewBuilder
    private var familyDestination: some View {
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


            Button("Leave family") {
                model.leaveFamily()
            }
            .disabled(model.isLoading)
        if let errorMessage = model.errorMessage {
            Text(errorMessage)
                .foregroundStyle(.red)
                .font(.footnote)
        }
        if model.isLoading {
            ProgressView()
        }
    }

    @ViewBuilder
    private var placesDestination: some View {
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

            let locatedPlaces = model.places.filter(\.isLocated)
            FieldMenuRow(
                label: "My default leave-from",
                valueText: model.defaultLeaveFromPlaceName
                    ?? (locatedPlaces.isEmpty ? "No located places yet" : "None"),
                disabled: model.isLoading
            ) {
                Button("None") { model.setDefaultLeaveFrom(placeId: nil) }
                    .disabled(model.isLoading)
                ForEach(locatedPlaces) { place in
                    Button(place.name) { model.setDefaultLeaveFrom(placeId: place.id) }
                        .disabled(model.isLoading)
                }
            }

    }

    @ViewBuilder
    private var calendarDestination: some View {
        let agendaListBusy = model.isLoading && !model.eventCompose.isOpen
        VStack(alignment: .leading, spacing: UiTokens.Space.xl) {
            Text("Agenda")
                .font(.headline)
            if model.calendarRevalidating {
                HStack(spacing: UiTokens.Space.sm) {
                    ProgressView()
                    Text("Updating…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .accessibilityIdentifier("agenda-revalidating")
            }
            if let errorMessage = model.errorMessage, !model.eventCompose.isOpen {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.footnote)
            }
            if !model.kids.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        Button("All kids") { model.agendaKidFilter = nil }
                            .buttonStyle(.bordered)
                            .tint(model.agendaKidFilter == nil ? .accentColor : .secondary)
                        ForEach(model.kids) { kid in
                            Button(kid.displayName) { model.agendaKidFilter = kid.id }
                                .buttonStyle(.bordered)
                                .tint(model.agendaKidFilter == kid.id ? .accentColor : .secondary)
                        }
                    }
                }
            }
            if model.visibleCalendarItems.isEmpty {
                // While the first calendar fetch (or Load more) is in flight, do not claim
                // the window is empty — busy feedback lives on Load more → Loading….
                if !agendaListBusy {
                    Text("No events in the loaded window.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                let items = model.visibleCalendarItems
                VStack(alignment: .leading, spacing: UiTokens.Space._2xl) {
                    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                        agendaItemRow(item: item, isLast: index == items.count - 1)
                    }
                }
                .padding(.top, UiTokens.Space.md)
            }
            Button {
                model.loadMoreCalendar()
            } label: {
                if agendaListBusy {
                    HStack(spacing: UiTokens.Space.sm) {
                        ProgressView()
                        Text("Loading…")
                    }
                } else {
                    Text("Load more")
                }
            }
            .disabled(model.isLoading)
            .accessibilityLabel(agendaListBusy ? "Loading…" : "Load more")
        }
    }

    @ViewBuilder
    private func agendaItemRow(item: FamilyCalendarItem, isLast: Bool) -> some View {
        VStack(alignment: .leading, spacing: UiTokens.Space.md) {
            // Primary — title / when / location (+ conflict status)
            VStack(alignment: .leading, spacing: UiTokens.Space.xs) {
                Text(item.title)
                    .font(.headline)
                Text(item.whenLabel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let location = item.location, !location.isEmpty {
                    Text(location)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                let conflictLines = ConflictDisplay.conflictDisplayLines(
                    item.conflicts,
                    kids: model.kids.map { ($0.id, $0.displayName) }
                )
                if !conflictLines.isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(conflictLines, id: \.self) { line in
                            Text(line)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(Color(red: 0xB4 / 255, green: 0x53 / 255, blue: 0x09 / 255))
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Schedule conflicts")
                    .accessibilityIdentifier("agenda-conflicts-\(item.source)-\(item.id)")
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(AgendaBands.primary)

            // Travel / origin — leave-by + Leave from (+ Open Places)
            VStack(alignment: .leading, spacing: UiTokens.Space.sm) {
                Text(item.leaveByAgendaLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                let locatedPlaces = model.places.filter(\.isLocated)
                if locatedPlaces.count <= 1 {
                    FieldValueRow(
                        label: "Leave from",
                        valueText: item.leaveFromPlaceName
                            ?? locatedPlaces.first?.name
                            ?? (model.places.isEmpty
                                ? "No places yet"
                                : "No located places yet")
                    )
                } else {
                    FieldMenuRow(
                        label: "Leave from",
                        valueText: item.leaveFromPlaceName
                            ?? "Choose a located place",
                        disabled: model.isLoading || model.places.isEmpty
                    ) {
                        ForEach(model.places) { place in
                            Button {
                                if place.isLocated {
                                    model.setCalendarLeaveFrom(item: item, placeId: place.id)
                                }
                            } label: {
                                Text(
                                    place.isLocated
                                        ? place.name
                                        : "\(place.name) (not located)"
                                )
                            }
                            .disabled(!place.isLocated)
                        }
                    }
                }
                if item.leaveByStatus == "UNAVAILABLE",
                   item.leaveByReason == "NO_ORIGIN"
                {
                    Button("Open Places") { model.openMorePlaces() }
                        .buttonStyle(.bordered)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(AgendaBands.travel)

            // People / source
            VStack(alignment: .leading, spacing: UiTokens.Space.xs) {
                Text(item.sourceLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                let kidsLabel = item.kidNamesLabel(kids: model.kids)
                if !kidsLabel.isEmpty {
                    Text(kidsLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(AgendaBands.people)

            // Coverage / actions
            AgendaCoverageSection(
                item: item,
                members: model.members,
                kids: model.kids,
                currentAdultId: model.currentAdultId,
                isLoading: model.isLoading,
                isManual: item.isManual,
                coverageActionError: model.coverageActionErrors["\(item.source)-\(item.id)"],
                onRemove: { model.removeCoverage(assignmentId: $0) },
                onConfirm: { model.confirmCoverage(assignmentId: $0) },
                onDecline: { model.declineCoverage(assignmentId: $0) },
                onAssign: { adultId, kidIds in
                    model.assignCoverage(
                        item: item,
                        coveringAdultId: adultId,
                        kidIds: kidIds
                    )
                },
                onEdit: { model.beginEditEvent(item) },
                onRemoveEvent: { model.removeEvent(item.id) }
            )
            .id("\(item.source)-\(item.id)-coverage")
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(AgendaBands.coverage)
        }
        .padding(.bottom, isLast ? 0 : UiTokens.Space.xl)
        .overlay(alignment: .bottom) {
            if !isLast {
                Rectangle()
                    .fill(FcTheme.border(colorScheme))
                    .frame(height: 1)
            }
        }
    }

    @ViewBuilder
    private var eventComposeDestination: some View {
        if let errorMessage = model.errorMessage {
            Text(errorMessage)
                .foregroundStyle(.red)
                .font(.footnote)
        }
        if model.eventCompose.isEditing {
            TextField("Event title", text: $model.editingEventTitle)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            DatePicker(
                "Event start",
                selection: $model.editingEventStartsAtDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .disabled(model.isLoading)
            Toggle("Event end", isOn: $model.editingEventHasEndsAt)
                .disabled(model.isLoading)
            if model.editingEventHasEndsAt {
                DatePicker(
                    "Event end",
                    selection: $model.editingEventEndsAtDate,
                    in: model.editingEventStartsAtDate...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .disabled(model.isLoading)
            }
            TextField("Event location (optional)", text: $model.editingEventLocation)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            feedKidToggles(selectedKidIds: model.editingEventKidIds) { kidId in
                model.toggleEditingEventKid(kidId)
            }
            Button {
                model.saveEvent()
            } label: {
                if model.isLoading {
                    HStack(spacing: UiTokens.Space.sm) {
                        ProgressView()
                        Text("Saving…")
                    }
                } else {
                    Text("Save")
                }
            }
            .disabled(
                model.isLoading
                    || model.editingEventTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || model.editingEventKidIds.isEmpty
            )
            .accessibilityLabel(model.isLoading ? "Saving…" : "Save")
        } else {
            TextField("Event title", text: $model.newEventTitle)
                .disabled(model.isLoading)
                .textFieldStyle(.roundedBorder)
            DatePicker(
                "Event start",
                selection: $model.newEventStartsAtDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .disabled(model.isLoading)
            Toggle("Event end", isOn: $model.newEventHasEndsAt)
                .disabled(model.isLoading)
            if model.newEventHasEndsAt {
                DatePicker(
                    "Event end",
                    selection: $model.newEventEndsAtDate,
                    in: model.newEventStartsAtDate...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .disabled(model.isLoading)
            }
            TextField("Event location (optional)", text: $model.newEventLocation)
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
            Button {
                model.addEvent()
            } label: {
                if model.isLoading {
                    HStack(spacing: UiTokens.Space.sm) {
                        ProgressView()
                        Text("Saving…")
                    }
                } else {
                    Text("Save")
                }
            }
            .disabled(
                model.isLoading
                    || model.newEventTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || model.newEventKidIds.isEmpty
            )
            .accessibilityLabel(model.isLoading ? "Saving…" : "Save")
        }
    }

    @ViewBuilder
    private var feedsDestination: some View {

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

    @ViewBuilder
    private var moreListDestination: some View {
        Text("General")
            .font(.system(size: UiTokens.Typography.caption.size, weight: .semibold))
            .foregroundStyle(FcTheme.textSecondary(colorScheme))
        moreRow(
            title: "Places",
            icon: UiTokens.Icon.places,
            showChevron: true
        ) {
            model.openMorePlaces()
        }
        if AppShellNavigationState.showsFeedsRow(isOrganizer: model.isOrganizer) {
            moreRow(
                title: "Feeds",
                icon: UiTokens.Icon.feeds,
                showChevron: true
            ) {
                model.openMoreFeeds()
            }
        }
        Text("Account")
            .font(.system(size: UiTokens.Typography.caption.size, weight: .semibold))
            .foregroundStyle(FcTheme.textSecondary(colorScheme))
            .padding(.top, UiTokens.Space.sm)
        moreRow(
            title: accountSummaryLabel,
            icon: UiTokens.Icon.family,
            showChevron: false,
            action: nil
        )
        moreRow(
            title: "Sign out",
            icon: UiTokens.Icon.signout,
            showChevron: false,
            danger: true
        ) {
            model.signOut()
        }
    }

    private var accountSummaryLabel: String {
        let email = model.signedInEmail.isEmpty ? "…" : model.signedInEmail
        let role = model.familyRole.isEmpty ? "…" : model.familyRole
        return "\(email) · \(role)"
    }

    @ViewBuilder
    private func moreRow(
        title: String,
        icon: String,
        showChevron: Bool,
        danger: Bool = false,
        action: (() -> Void)?
    ) -> some View {
        let contentColor: Color =
            danger ? FcTheme.danger(colorScheme) : FcTheme.textPrimary(colorScheme)
        let chipFill: Color =
            (danger ? FcTheme.danger(colorScheme) : FcTheme.accent(colorScheme)).opacity(0.15)
        Button {
            action?()
        } label: {
            HStack(spacing: UiTokens.Space.md) {
                Image(systemName: UiIcons.systemName(icon))
                    .frame(width: 28, height: 28)
                    .foregroundStyle(contentColor)
                    .background(
                        chipFill,
                        in: RoundedRectangle(cornerRadius: UiTokens.Radius.md)
                    )
                Text(title)
                    .font(.system(size: UiTokens.Typography.body.size))
                    .foregroundStyle(contentColor)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if showChevron {
                    Image(systemName: UiIcons.systemName(UiTokens.Icon.chevron))
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FcTheme.textSecondary(colorScheme))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
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

private enum AgendaBands {
    static let primary = "agenda-band-primary"
    static let travel = "agenda-band-travel"
    static let people = "agenda-band-people"
    static let coverage = "agenda-band-coverage"
    static let ctaPrimary = "agenda-cta-primary"
}

private struct AgendaCoverageSection: View {
    let item: FamilyCalendarItem
    let members: [FamilyMemberItem]
    let kids: [FamilyKidItem]
    let currentAdultId: String
    let isLoading: Bool
    let isManual: Bool
    let coverageActionError: String?
    let onRemove: (String) -> Void
    let onConfirm: (String) -> Void
    let onDecline: (String) -> Void
    let onAssign: (String, [String]) -> Void
    let onEdit: () -> Void
    let onRemoveEvent: () -> Void

    @State private var assignAdultId: String = ""
    @State private var assignKidIds: Set<String> = []
    @State private var didInitAssignDraft = false

    private var memberTuples: [(adultId: String, displayName: String, email: String)] {
        members.map { ($0.adultId, $0.displayName, $0.email) }
    }

    private var kidTuples: [(id: String, displayName: String)] {
        kids.map { ($0.id, $0.displayName) }
    }

    private var soleAdult: Bool { members.count == 1 }
    private var soleKid: Bool { item.uncoveredKidIds.count == 1 }

    private var effectiveAdultId: String {
        if soleAdult { return members[0].adultId }
        if !assignAdultId.isEmpty { return assignAdultId }
        return CoverageDisplay.defaultCoverageAdultId(
            currentAdultId: currentAdultId,
            memberAdultIds: members.map(\.adultId)
        )
    }

    private var effectiveKidIds: [String] {
        if soleKid { return item.uncoveredKidIds }
        return Array(assignKidIds)
    }

    private func syncAssignDraftFromItem() {
        if assignAdultId.isEmpty {
            assignAdultId = CoverageDisplay.defaultCoverageAdultId(
                currentAdultId: currentAdultId,
                memberAdultIds: members.map(\.adultId)
            )
        }
        assignKidIds = CoverageDisplay.defaultCoverageKidIds(item.uncoveredKidIds)
    }

    var body: some View {
        let active = CoverageDisplay.activeCoverages(item.coverages)
        let pending = CoverageDisplay.pendingCoverageForAdult(
            item.coverages,
            adultId: currentAdultId
        )
        let uncoveredNames = CoverageDisplay.eventKidNames(
            kidIds: item.uncoveredKidIds,
            kids: kidTuples
        )

        VStack(alignment: .leading, spacing: UiTokens.Space.sm) {
            ForEach(active) { coverage in
                HStack(alignment: .top) {
                    Text(
                        "\(CoverageDisplay.coverageAdultLabel(coverage, members: memberTuples)) · "
                            + "\(CoverageDisplay.coverageKidNames(coverage, kids: kidTuples)) · "
                            + CoverageDisplay.coverageStatusLabel(coverage.status)
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Button("Remove coverage") { onRemove(coverage.id) }
                        .font(.caption)
                        .buttonStyle(.bordered)
                        .disabled(isLoading)
                }
            }

            if !item.uncoveredKidIds.isEmpty {
                Text(
                    uncoveredNames.isEmpty
                        ? "Needs coverage"
                        : "Needs coverage: \(uncoveredNames)"
                )
                .font(.caption)
                .foregroundStyle(.red)
            }

            if let pending {
                HStack {
                    Button("Confirm coverage") { onConfirm(pending.id) }
                        .buttonStyle(.borderedProminent)
                        .disabled(isLoading)
                        .accessibilityIdentifier(AgendaBands.ctaPrimary)
                    Button("Decline coverage") { onDecline(pending.id) }
                        .buttonStyle(.bordered)
                        .disabled(isLoading)
                }
            }

            if !item.uncoveredKidIds.isEmpty, !members.isEmpty {
                if !soleAdult {
                    FieldMenuRow(
                        label: "Covering adult",
                        valueText: members.first(where: { $0.adultId == effectiveAdultId }).map {
                            CoverageDisplay.memberLabel(displayName: $0.displayName, email: $0.email)
                        } ?? "Choose adult",
                        disabled: isLoading
                    ) {
                        ForEach(members) { member in
                            Button(CoverageDisplay.memberLabel(
                                displayName: member.displayName,
                                email: member.email
                            )) {
                                assignAdultId = member.adultId
                            }
                            .disabled(isLoading)
                        }
                    }
                }

                if !soleKid {
                    Text("Uncovered kids")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    ForEach(item.uncoveredKidIds, id: \.self) { kidId in
                        if let kid = kids.first(where: { $0.id == kidId }) {
                            Toggle(
                                kid.displayName,
                                isOn: Binding(
                                    get: { assignKidIds.contains(kidId) },
                                    set: { checked in
                                        // Toggling kids must not clear the covering-adult default.
                                        if checked {
                                            assignKidIds.insert(kidId)
                                        } else {
                                            assignKidIds.remove(kidId)
                                        }
                                    }
                                )
                            )
                            .disabled(isLoading)
                        }
                    }
                }

                // Assign is filled primary only when Confirm is absent.
                // Apply buttonStyle on the Button itself (not via if/else ViewModifier) —
                // conditional ViewModifier styles can swallow taps on some OS versions.
                if pending == nil {
                    Button("Assign coverage") {
                        onAssign(effectiveAdultId, effectiveKidIds)
                        assignKidIds = CoverageDisplay.defaultCoverageKidIds(item.uncoveredKidIds)
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier(AgendaBands.ctaPrimary)
                    .disabled(isLoading || effectiveAdultId.isEmpty || effectiveKidIds.isEmpty)
                } else {
                    Button("Assign coverage") {
                        onAssign(effectiveAdultId, effectiveKidIds)
                        assignKidIds = CoverageDisplay.defaultCoverageKidIds(item.uncoveredKidIds)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLoading || effectiveAdultId.isEmpty || effectiveKidIds.isEmpty)
                }
            }

            if let coverageActionError {
                Text(coverageActionError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("agenda-coverage-error-\(item.source)-\(item.id)")
            }

            if isManual {
                HStack {
                    Button("Edit") { onEdit() }
                        .buttonStyle(.bordered)
                        .disabled(isLoading)
                    Button("Remove event") { onRemoveEvent() }
                        .buttonStyle(.bordered)
                        .disabled(isLoading)
                }
            }
        }
        .onAppear {
            if !didInitAssignDraft {
                syncAssignDraftFromItem()
                didInitAssignDraft = true
            }
        }
        .onChange(of: item.uncoveredKidIds) { _, _ in
            syncAssignDraftFromItem()
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
