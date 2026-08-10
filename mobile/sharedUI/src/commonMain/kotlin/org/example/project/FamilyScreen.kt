package org.example.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun FamilyScreen(
    session: AuthSession,
    onSignOut: () -> Unit,
    familyClient: FamilyClient = remember { FamilyClient.create() },
) {
    val model = remember(session, familyClient) { FamilyUiModel(session, familyClient) }
    var state by remember { mutableStateOf(model.state) }
    val scope = rememberCoroutineScope()

    fun refresh() {
        state = model.state
    }

    LaunchedEffect(session, familyClient) {
        model.load()
        refresh()
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when (val current = state) {
            is FamilyUiModel.State.Loading -> {
                Text("Your family", style = MaterialTheme.typography.headlineSmall)
                CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
            }

            is FamilyUiModel.State.NeedsMembership -> {
                NeedsMembershipContent(
                    current = current,
                    model = model,
                    refresh = ::refresh,
                    onSignOut = onSignOut,
                    scope = scope,
                )
            }

            is FamilyUiModel.State.Ready -> {
                ReadyContent(
                    current = current,
                    model = model,
                    refresh = ::refresh,
                    onSignOut = onSignOut,
                    scope = scope,
                )
            }
        }
    }
}

@Composable
private fun NeedsMembershipContent(
    current: FamilyUiModel.State.NeedsMembership,
    model: FamilyUiModel,
    refresh: () -> Unit,
    onSignOut: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val title =
        when (current.mode) {
            FamilyUiModel.EmptyMode.JOIN -> "Join a family"
            FamilyUiModel.EmptyMode.CREATE -> "Create your family"
            FamilyUiModel.EmptyMode.CHOOSE -> "Your family"
        }
    Text(title, style = MaterialTheme.typography.headlineSmall)
    Text(
        text = "Signed in as ${current.email.ifBlank { "…" }}. Create a circle or join with an invite code.",
        style = MaterialTheme.typography.bodyMedium,
    )

    when (current.mode) {
        FamilyUiModel.EmptyMode.CHOOSE -> {
            Button(
                onClick = {
                    model.showCreate()
                    refresh()
                },
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Create family")
            }
            OutlinedButton(
                onClick = {
                    model.showJoin()
                    refresh()
                },
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Have an invite code?")
            }
        }

        FamilyUiModel.EmptyMode.CREATE -> {
            OutlinedTextField(
                value = current.adultDisplayName,
                onValueChange = {
                    model.updateAdultDisplayName(it)
                    refresh()
                },
                label = { Text("Your name") },
                singleLine = true,
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = current.circleName,
                onValueChange = {
                    model.updateCircleName(it)
                    refresh()
                },
                label = { Text("Your family (optional)") },
                placeholder = { Text("Your family") },
                singleLine = true,
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    scope.launch {
                        model.createCircle()
                        refresh()
                    }
                },
                enabled = !current.loading && current.adultDisplayName.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (current.loading) "Creating…" else "Create family")
            }
            OutlinedButton(
                onClick = {
                    model.showChoose()
                    refresh()
                },
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Back")
            }
        }

        FamilyUiModel.EmptyMode.JOIN -> {
            OutlinedTextField(
                value = current.inviteCodeInput,
                onValueChange = {
                    model.updateInviteCodeInput(it)
                    refresh()
                },
                label = { Text("Invite code") },
                singleLine = true,
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            )
            if (!current.hasDisplayName) {
                OutlinedTextField(
                    value = current.adultDisplayName,
                    onValueChange = {
                        model.updateAdultDisplayName(it)
                        refresh()
                    },
                    label = { Text("Your name") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Button(
                onClick = {
                    scope.launch {
                        model.joinCircle()
                        refresh()
                    }
                },
                enabled =
                    !current.loading &&
                        current.inviteCodeInput.isNotBlank() &&
                        (current.hasDisplayName || current.adultDisplayName.isNotBlank()),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (current.loading) "Joining…" else "Join family")
            }
            OutlinedButton(
                onClick = {
                    model.showChoose()
                    refresh()
                },
                enabled = !current.loading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Back")
            }
        }
    }

    if (current.error != null) {
        Text(text = current.error, color = MaterialTheme.colorScheme.error)
    }
    OutlinedButton(
        onClick = onSignOut,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Sign out")
    }
}

@Composable
private fun ReadyContent(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    onSignOut: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val isOrganizer = current.circle.role == FamilyRole.ORGANIZER

    Text(current.circle.displayTitle(), style = MaterialTheme.typography.headlineSmall)
    Text(
        text =
            buildString {
                current.adultDisplayName?.let { append("$it · ") }
                append(current.email)
                append(" · ")
                append(current.circle.role.name)
            },
        style = MaterialTheme.typography.bodyMedium,
    )

    if (isOrganizer && current.inviteCode != null) {
        Text("Invite code: ${current.inviteCode}", style = MaterialTheme.typography.bodyMedium)
        OutlinedButton(
            onClick = {
                scope.launch {
                    model.regenerateInvite()
                    refresh()
                }
            },
            enabled = !current.loading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Regenerate code")
        }
    }

    Text("Members", style = MaterialTheme.typography.titleSmall)
    current.circle.members.forEach { member ->
        val isSelf = member.adultId == current.adultId
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text =
                    buildString {
                        append(member.displayLabel())
                        append(" · ")
                        append(member.role.name)
                        if (isSelf) append(" (you)")
                    },
                modifier = Modifier.weight(1f),
            )
        }
        if (isOrganizer && !isSelf) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (member.role == FamilyRole.CAREGIVER) {
                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                model.updateMemberRole(member.adultId, FamilyRole.ORGANIZER)
                                refresh()
                            }
                        },
                        enabled = !current.loading,
                    ) {
                        Text("Promote")
                    }
                } else {
                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                model.updateMemberRole(member.adultId, FamilyRole.CAREGIVER)
                                refresh()
                            }
                        },
                        enabled = !current.loading,
                    ) {
                        Text("Demote")
                    }
                }
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            model.removeMember(member.adultId)
                            refresh()
                        }
                    },
                    enabled = !current.loading,
                ) {
                    Text("Remove")
                }
            }
        }
    }

    if (current.circle.kids.isEmpty()) {
        Text("No kids yet.", style = MaterialTheme.typography.bodySmall)
    } else {
        current.circle.kids.forEach { kid ->
            if (isOrganizer && current.editingKidId == kid.id) {
                OutlinedTextField(
                    value = current.editingKidName,
                    onValueChange = {
                        model.updateEditingKidName(it)
                        refresh()
                    },
                    label = { Text("Rename ${kid.displayName}") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                model.saveRename()
                                refresh()
                            }
                        },
                        enabled = !current.loading && current.editingKidName.isNotBlank(),
                    ) {
                        Text("Save")
                    }
                    OutlinedButton(
                        onClick = {
                            model.cancelRename()
                            refresh()
                        },
                        enabled = !current.loading,
                    ) {
                        Text("Cancel")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(kid.displayName, modifier = Modifier.weight(1f))
                    if (isOrganizer) {
                        OutlinedButton(
                            onClick = {
                                model.beginRename(kid)
                                refresh()
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Rename")
                        }
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    model.removeKid(kid.id)
                                    refresh()
                                }
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Remove")
                        }
                    }
                }
            }
        }
    }

    if (isOrganizer) {
        OutlinedTextField(
            value = current.newKidName,
            onValueChange = {
                model.updateNewKidName(it)
                refresh()
            },
            label = { Text("New kid name") },
            singleLine = true,
            enabled = !current.loading,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = {
                scope.launch {
                    model.addKid()
                    refresh()
                }
            },
            enabled = !current.loading && current.newKidName.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Add kid")
        }
    }

    Text("Places", style = MaterialTheme.typography.titleSmall)
    if (current.circle.places.isEmpty()) {
        Text("No places yet.", style = MaterialTheme.typography.bodySmall)
    } else {
        current.circle.places.forEach { place ->
            if (current.editingPlaceId == place.id) {
                OutlinedTextField(
                    value = current.editingPlaceName,
                    onValueChange = {
                        model.updateEditingPlaceName(it)
                        refresh()
                    },
                    label = { Text("Place name") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = current.editingPlaceAddress,
                    onValueChange = {
                        model.updateEditingPlaceAddress(it)
                        refresh()
                    },
                    label = { Text("Address") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                model.savePlace()
                                refresh()
                            }
                        },
                        enabled =
                            !current.loading &&
                                current.editingPlaceName.isNotBlank() &&
                                current.editingPlaceAddress.isNotBlank(),
                    ) {
                        Text("Save")
                    }
                    OutlinedButton(
                        onClick = {
                            model.cancelEditPlace()
                            refresh()
                        },
                        enabled = !current.loading,
                    ) {
                        Text("Cancel")
                    }
                }
            } else {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(place.name)
                    Text(place.address, style = MaterialTheme.typography.bodySmall)
                    Text(
                        if (place.isLocated()) "Located" else "Not located",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!place.isLocated()) {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        model.locatePlace(place.id)
                                        refresh()
                                    }
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Retry locate")
                            }
                        }
                        OutlinedButton(
                            onClick = {
                                model.beginEditPlace(place)
                                refresh()
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Edit")
                        }
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    model.removePlace(place.id)
                                    refresh()
                                }
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Remove place")
                        }
                    }
                }
            }
        }
    }

    OutlinedTextField(
        value = current.newPlaceName,
        onValueChange = {
            model.updateNewPlaceName(it)
            refresh()
        },
        label = { Text("New place name") },
        singleLine = true,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    )
    OutlinedTextField(
        value = current.newPlaceAddress,
        onValueChange = {
            model.updateNewPlaceAddress(it)
            refresh()
        },
        label = { Text("New place address") },
        singleLine = true,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    )
    Button(
        onClick = {
            scope.launch {
                model.addPlace()
                refresh()
            }
        },
        enabled =
            !current.loading &&
                current.newPlaceName.isNotBlank() &&
                current.newPlaceAddress.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Add place")
    }

    Text("Manual events", style = MaterialTheme.typography.titleSmall)
    if (current.events.isEmpty()) {
        Text("No manual events yet.", style = MaterialTheme.typography.bodySmall)
    } else {
        current.events.forEach { event ->
            if (current.editingEventId == event.id) {
                OutlinedTextField(
                    value = current.editingEventTitle,
                    onValueChange = {
                        model.updateEditingEventTitle(it)
                        refresh()
                    },
                    label = { Text("Title") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = current.editingEventStartsAt,
                    onValueChange = {
                        model.updateEditingEventStartsAt(it)
                        refresh()
                    },
                    label = { Text("Starts at (ISO-8601)") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = current.editingEventEndsAt,
                    onValueChange = {
                        model.updateEditingEventEndsAt(it)
                        refresh()
                    },
                    label = { Text("Ends at (optional)") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = current.editingEventLocation,
                    onValueChange = {
                        model.updateEditingEventLocation(it)
                        refresh()
                    },
                    label = { Text("Location (optional)") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                FeedKidCheckboxes(
                    kids = current.circle.kids,
                    selectedKidIds = current.editingEventKidIds,
                    enabled = !current.loading,
                    onToggle = {
                        model.toggleEditingEventKid(it)
                        refresh()
                    },
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            scope.launch {
                                model.saveEvent()
                                refresh()
                            }
                        },
                        enabled =
                            !current.loading &&
                                current.editingEventTitle.isNotBlank() &&
                                current.editingEventStartsAt.isNotBlank() &&
                                current.editingEventKidIds.isNotEmpty(),
                    ) {
                        Text("Save")
                    }
                    OutlinedButton(
                        onClick = {
                            model.cancelEditEvent()
                            refresh()
                        },
                        enabled = !current.loading,
                    ) {
                        Text("Cancel")
                    }
                }
            } else {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(event.title)
                    Text(
                        if (event.endsAt.isNullOrBlank()) {
                            event.startsAt
                        } else {
                            "${event.startsAt} → ${event.endsAt}"
                        },
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (!event.location.isNullOrBlank()) {
                        Text(event.location!!, style = MaterialTheme.typography.bodySmall)
                    }
                    val kidNames =
                        event.kidIds.mapNotNull { id ->
                            current.circle.kids.find { it.id == id }?.displayName
                        }.joinToString(", ")
                    if (kidNames.isNotEmpty()) {
                        Text(kidNames, style = MaterialTheme.typography.bodySmall)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = {
                                model.beginEditEvent(event)
                                refresh()
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Edit")
                        }
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    model.removeEvent(event.id)
                                    refresh()
                                }
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Remove event")
                        }
                    }
                }
            }
        }
    }

    OutlinedTextField(
        value = current.newEventTitle,
        onValueChange = {
            model.updateNewEventTitle(it)
            refresh()
        },
        label = { Text("New event title") },
        singleLine = true,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    )
    OutlinedTextField(
        value = current.newEventStartsAt,
        onValueChange = {
            model.updateNewEventStartsAt(it)
            refresh()
        },
        label = { Text("Starts at (ISO-8601)") },
        singleLine = true,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    )
    OutlinedTextField(
        value = current.newEventEndsAt,
        onValueChange = {
            model.updateNewEventEndsAt(it)
            refresh()
        },
        label = { Text("Ends at (optional)") },
        singleLine = true,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    )
    OutlinedTextField(
        value = current.newEventLocation,
        onValueChange = {
            model.updateNewEventLocation(it)
            refresh()
        },
        label = { Text("Location (optional)") },
        singleLine = true,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    )
    if (current.circle.kids.isEmpty()) {
        Text(
            "Add a kid before creating a manual event.",
            style = MaterialTheme.typography.bodySmall,
        )
    } else {
        FeedKidCheckboxes(
            kids = current.circle.kids,
            selectedKidIds = current.newEventKidIds,
            enabled = !current.loading,
            onToggle = {
                model.toggleNewEventKid(it)
                refresh()
            },
        )
    }
    Button(
        onClick = {
            scope.launch {
                model.addEvent()
                refresh()
            }
        },
        enabled =
            !current.loading &&
                current.newEventTitle.isNotBlank() &&
                current.newEventStartsAt.isNotBlank() &&
                current.newEventKidIds.isNotEmpty(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Add event")
    }

    if (isOrganizer) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Activity feeds", style = MaterialTheme.typography.titleSmall)
            OutlinedButton(
                onClick = {
                    scope.launch {
                        model.refreshFeeds()
                        refresh()
                    }
                },
                enabled = !current.loading,
            ) {
                Text("Refresh")
            }
        }
        if (current.feeds.isEmpty()) {
            Text("No feeds yet.", style = MaterialTheme.typography.bodySmall)
        } else {
            current.feeds.forEach { feed ->
                if (current.editingFeedId == feed.id) {
                    OutlinedTextField(
                        value = current.editingFeedName,
                        onValueChange = {
                            model.updateEditingFeedName(it)
                            refresh()
                        },
                        label = { Text("Feed name") },
                        singleLine = true,
                        enabled = !current.loading,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = current.editingFeedUrl,
                        onValueChange = {
                            model.updateEditingFeedUrl(it)
                            refresh()
                        },
                        label = { Text("Feed URL") },
                        singleLine = true,
                        enabled = !current.loading,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    FeedKidCheckboxes(
                        kids = current.circle.kids,
                        selectedKidIds = current.editingFeedKidIds,
                        enabled = !current.loading,
                        onToggle = {
                            model.toggleEditingFeedKid(it)
                            refresh()
                        },
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                scope.launch {
                                    model.saveFeed()
                                    refresh()
                                }
                            },
                            enabled =
                                !current.loading &&
                                    current.editingFeedName.isNotBlank() &&
                                    current.editingFeedUrl.isNotBlank(),
                        ) {
                            Text("Save")
                        }
                        OutlinedButton(
                            onClick = {
                                model.cancelEditFeed()
                                refresh()
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Cancel")
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            feed.name,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            feed.listStatusLabel(current.circle.kids),
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        model.syncFeed(feed.id)
                                        refresh()
                                    }
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Sync now")
                            }
                            OutlinedButton(
                                onClick = {
                                    model.beginEditFeed(feed)
                                    refresh()
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Edit")
                            }
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        model.removeFeed(feed.id)
                                        refresh()
                                    }
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Remove")
                            }
                        }
                    }
                }
            }
        }
        OutlinedTextField(
            value = current.newFeedName,
            onValueChange = {
                model.updateNewFeedName(it)
                refresh()
            },
            label = { Text("New feed name") },
            singleLine = true,
            enabled = !current.loading,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = current.newFeedUrl,
            onValueChange = {
                model.updateNewFeedUrl(it)
                refresh()
            },
            label = { Text("Feed URL") },
            singleLine = true,
            enabled = !current.loading,
            modifier = Modifier.fillMaxWidth(),
        )
        FeedKidCheckboxes(
            kids = current.circle.kids,
            selectedKidIds = current.newFeedKidIds,
            enabled = !current.loading,
            onToggle = {
                model.toggleNewFeedKid(it)
                refresh()
            },
        )
        Button(
            onClick = {
                scope.launch {
                    model.addFeed()
                    refresh()
                }
            },
            enabled =
                !current.loading &&
                    current.newFeedName.isNotBlank() &&
                    current.newFeedUrl.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Add feed")
        }
    }

    if (current.error != null) {
        Text(text = current.error, color = MaterialTheme.colorScheme.error)
    }
    if (current.loading) {
        CircularProgressIndicator()
    }
    OutlinedButton(
        onClick = {
            scope.launch {
                model.leaveCircle()
                refresh()
            }
        },
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Leave family")
    }
    OutlinedButton(
        onClick = onSignOut,
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text("Sign out")
    }
}

@Composable
private fun FeedKidCheckboxes(
    kids: List<Kid>,
    selectedKidIds: List<String>,
    enabled: Boolean,
    onToggle: (String) -> Unit,
) {
    kids.forEach { kid ->
        Row(modifier = Modifier.fillMaxWidth()) {
            Checkbox(
                checked = kid.id in selectedKidIds,
                onCheckedChange = { onToggle(kid.id) },
                enabled = enabled,
            )
            Text(kid.displayName, modifier = Modifier.padding(top = 12.dp))
        }
    }
}
