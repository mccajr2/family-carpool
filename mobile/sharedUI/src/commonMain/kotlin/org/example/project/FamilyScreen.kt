package org.example.project

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.example.project.ui.FcRadiusMd
import org.example.project.ui.FcSpace2xl
import org.example.project.ui.FcSpaceMd
import org.example.project.ui.FcSpaceSm
import org.example.project.ui.FcSpaceXl
import org.example.project.ui.FcSpaceXs
import org.example.project.ui.FcTheme
import org.example.project.ui.UiIcons
import org.example.project.ui.UiTokens

/** Agenda presentation hierarchy markers (calendar-ux-flow / coverage contract). */
internal object AgendaBands {
    const val PRIMARY = "agenda-band-primary"
    const val TRAVEL = "agenda-band-travel"
    const val PEOPLE = "agenda-band-people"
    const val COVERAGE = "agenda-band-coverage"
    const val MANUAL_ACTIONS = "agenda-band-manual-actions"
    const val CTA_PRIMARY = "agenda-cta-primary"
}

private data class PendingRsvpConfirm(
    val item: CalendarItem,
    val kidId: String,
    val status: RsvpStatus,
    val kidName: String,
)

@Composable
fun FamilyScreen(
    session: AuthSession,
    onSignOut: () -> Unit,
    familyClient: FamilyClient = remember { FamilyClient.create() },
    calendarCacheStore: CalendarCacheStore = remember { InMemoryCalendarCacheStore() },
    bootstrapCacheStore: FamilyBootstrapCache = remember { InMemoryFamilyBootstrapCache() },
    carpoolClient: CarpoolClient = remember { CarpoolClient.create() },
) {
    val model =
        remember(session, familyClient, calendarCacheStore, bootstrapCacheStore, carpoolClient) {
            FamilyUiModel(
                session = session,
                familyClient = familyClient,
                calendarCache = calendarCacheStore,
                bootstrapCache = bootstrapCacheStore,
                carpoolClient = carpoolClient,
            )
        }
    var state by remember { mutableStateOf(model.state) }
    val scope = rememberCoroutineScope()

    fun refresh() {
        state = model.state
    }

    // Push model updates while suspend work is in flight (loading=true), not only after.
    DisposableEffect(model) {
        model.stateListener = { refresh() }
        onDispose { model.stateListener = null }
    }

    LaunchedEffect(session, familyClient, calendarCacheStore, bootstrapCacheStore) {
        model.load()
        refresh()
    }

    val readyShellTab = (state as? FamilyUiModel.State.Ready)?.shellTab
    val readyMoreScreen = (state as? FamilyUiModel.State.Ready)?.moreScreen
    LaunchedEffect(readyShellTab) {
        if (readyShellTab == FamilyUiModel.ShellTab.CALENDAR) {
            model.revalidateCalendarIfStale()
            refresh()
        }
    }
    LaunchedEffect(readyShellTab, readyMoreScreen) {
        if (readyShellTab == FamilyUiModel.ShellTab.CARPOOL ||
            readyMoreScreen == FamilyUiModel.MoreScreen.FEEDS
        ) {
            model.loadCarpoolSummary()
            refresh()
        }
    }

    when (val current = state) {
        is FamilyUiModel.State.Loading -> {
            Column(
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Your family", style = MaterialTheme.typography.headlineSmall)
                // No spinner — bootstrap paint skips this; first install waits quietly for circle.
            }
        }

        is FamilyUiModel.State.LoadFailed -> {
            Column(
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Your family", style = MaterialTheme.typography.headlineSmall)
                Text(text = current.message, color = MaterialTheme.colorScheme.error)
                Button(
                    onClick = {
                        scope.launch {
                            model.load()
                            refresh()
                        }
                    },
                ) {
                    Text("Retry")
                }
                OutlinedButton(onClick = onSignOut) {
                    Text("Sign out")
                }
            }
        }

        is FamilyUiModel.State.NeedsMembership -> {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                NeedsMembershipContent(
                    current = current,
                    model = model,
                    refresh = ::refresh,
                    onSignOut = onSignOut,
                    scope = scope,
                )
            }
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
    val moreScreen =
        if (current.moreScreen == FamilyUiModel.MoreScreen.FEEDS &&
            !AppShell.showsFeedsRow(isOrganizer)
        ) {
            FamilyUiModel.MoreScreen.LIST
        } else {
            current.moreScreen
        }

    Scaffold(
        bottomBar = {
            NavigationBar {
                ShellTabItem(
                    label = AppShell.TAB_CALENDAR,
                    icon = UiIcons.imageVector(UiTokens.Icon.calendar),
                    selected = current.shellTab == FamilyUiModel.ShellTab.CALENDAR,
                    onClick = {
                        model.selectShellTab(FamilyUiModel.ShellTab.CALENDAR)
                        refresh()
                    },
                )
                ShellTabItem(
                    label = AppShell.TAB_CARPOOL,
                    icon = UiIcons.imageVector(UiTokens.Icon.carpool),
                    selected = current.shellTab == FamilyUiModel.ShellTab.CARPOOL,
                    onClick = {
                        model.selectShellTab(FamilyUiModel.ShellTab.CARPOOL)
                        refresh()
                    },
                )
                ShellTabItem(
                    label = AppShell.TAB_FAMILY,
                    icon = UiIcons.imageVector(UiTokens.Icon.family),
                    selected = current.shellTab == FamilyUiModel.ShellTab.FAMILY,
                    onClick = {
                        model.selectShellTab(FamilyUiModel.ShellTab.FAMILY)
                        refresh()
                    },
                )
                ShellTabItem(
                    label = AppShell.TAB_MORE,
                    icon = UiIcons.imageVector(UiTokens.Icon.more),
                    selected = current.shellTab == FamilyUiModel.ShellTab.MORE,
                    onClick = {
                        model.selectShellTab(FamilyUiModel.ShellTab.MORE)
                        refresh()
                    },
                )
            }
        },
    ) { padding ->
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(padding)
                    .padding(8.dp)
                    .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            when (current.shellTab) {
                FamilyUiModel.ShellTab.CALENDAR -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(AppShell.TAB_CALENDAR, style = MaterialTheme.typography.headlineSmall)
                        if (!current.eventComposeOpen) {
                            Button(
                                onClick = {
                                    model.openCreateEventCompose()
                                    refresh()
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Add")
                            }
                        }
                    }
                    if (current.eventComposeOpen) {
                        EventComposeDestination(
                            current = current,
                            model = model,
                            refresh = refresh,
                            scope = scope,
                        )
                    } else {
                        CalendarDestination(
                            current = current,
                            model = model,
                            refresh = refresh,
                            scope = scope,
                        )
                    }
                }
                FamilyUiModel.ShellTab.CARPOOL -> {
                    CarpoolDestination(
                        current = current,
                        model = model,
                        refresh = refresh,
                        scope = scope,
                    )
                }
                FamilyUiModel.ShellTab.FAMILY -> {
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
                    FamilyDestination(
                        current = current,
                        model = model,
                        refresh = refresh,
                        scope = scope,
                        isOrganizer = isOrganizer,
                    )
                }
                FamilyUiModel.ShellTab.MORE -> {
                    when (moreScreen) {
                        FamilyUiModel.MoreScreen.LIST -> {
                            FcTheme {
                                Column(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .background(MaterialTheme.colorScheme.background)
                                            .padding(vertical = FcSpaceSm),
                                    verticalArrangement = Arrangement.spacedBy(FcSpaceSm),
                                ) {
                                    Text(
                                        AppShell.TAB_MORE,
                                        style = MaterialTheme.typography.headlineSmall,
                                        color = MaterialTheme.colorScheme.onBackground,
                                    )
                                    MoreListDestination(
                                        current = current,
                                        model = model,
                                        refresh = refresh,
                                        onSignOut = onSignOut,
                                        isOrganizer = isOrganizer,
                                    )
                                }
                            }
                        }
                        FamilyUiModel.MoreScreen.PLACES -> {
                            OutlinedButton(
                                onClick = {
                                    model.openMoreList()
                                    refresh()
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Back")
                            }
                            Text(AppShell.ROW_PLACES, style = MaterialTheme.typography.headlineSmall)
                            PlacesDestination(
                                current = current,
                                model = model,
                                refresh = refresh,
                                scope = scope,
                            )
                        }
                        FamilyUiModel.MoreScreen.FEEDS -> {
                            OutlinedButton(
                                onClick = {
                                    model.openMoreList()
                                    refresh()
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Back")
                            }
                            Text(AppShell.ROW_FEEDS, style = MaterialTheme.typography.headlineSmall)
                            FeedsDestination(
                                current = current,
                                model = model,
                                refresh = refresh,
                                scope = scope,
                            )
                        }
                    }
                }
            }
            if (current.error != null && current.shellTab != FamilyUiModel.ShellTab.CALENDAR) {
                Text(text = current.error, color = MaterialTheme.colorScheme.error)
            }
            // Busy feedback stays on focused controls (Save / Load more) — no global banner.
        }
    }
}

@Composable
private fun RowScope.ShellTabItem(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
) {
    NavigationBarItem(
        selected = selected,
        onClick = onClick,
        icon = {
            Icon(
                imageVector = icon,
                contentDescription = label,
            )
        },
        label = { Text(label) },
    )
}

@Composable
private fun MoreListDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    onSignOut: () -> Unit,
    isOrganizer: Boolean,
) {
    Text(
        AppShell.MORE_GROUP_GENERAL,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    MoreSettingsRow(
        label = AppShell.ROW_PLACES,
        icon = UiIcons.imageVector(UiTokens.Icon.places),
        showChevron = true,
        onClick = {
            model.openMorePlaces()
            refresh()
        },
    )
    if (AppShell.showsFeedsRow(isOrganizer)) {
        MoreSettingsRow(
            label = AppShell.ROW_FEEDS,
            icon = UiIcons.imageVector(UiTokens.Icon.feeds),
            showChevron = true,
            onClick = {
                model.openMoreFeeds()
                refresh()
            },
        )
    }
    Text(
        AppShell.MORE_GROUP_ACCOUNT,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = FcSpaceSm),
    )
    MoreSettingsRow(
        label = "${current.email} · ${current.circle.role.name}",
        icon = UiIcons.imageVector(UiTokens.Icon.family),
        showChevron = false,
        onClick = null,
    )
    MoreSettingsRow(
        label = AppShell.ROW_SIGN_OUT,
        icon = UiIcons.imageVector(UiTokens.Icon.signout),
        showChevron = false,
        danger = true,
        onClick = onSignOut,
    )
}

@Composable
private fun MoreSettingsRow(
    label: String,
    icon: ImageVector,
    showChevron: Boolean,
    onClick: (() -> Unit)?,
    danger: Boolean = false,
) {
    val contentColor =
        if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    val chipColor =
        if (danger) {
            MaterialTheme.colorScheme.error.copy(alpha = 0.15f)
        } else {
            MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(
                    if (onClick != null) {
                        Modifier.clickable(onClick = onClick)
                    } else {
                        Modifier
                    },
                )
                .padding(vertical = FcSpaceXs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(FcSpaceMd),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .background(chipColor, shape = RoundedCornerShape(FcRadiusMd)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(20.dp),
            )
        }
        Text(
            text = label,
            color = contentColor,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyLarge,
        )
        if (showChevron) {
            Icon(
                imageVector = UiIcons.imageVector(UiTokens.Icon.chevron),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun FamilyDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
    isOrganizer: Boolean,
) {
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
}

@Composable
private fun PlacesDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
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

    val locatedPlaces = current.circle.places.filter { it.isLocated() }
    var defaultLeaveFromExpanded by remember { mutableStateOf(false) }
    FieldRow(label = FieldRowLabels.DEFAULT_LEAVE_FROM) {
        Box {
            Row(
                modifier =
                    Modifier.clickable(enabled = !current.loading) {
                        defaultLeaveFromExpanded = true
                    },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                FieldRowValueText(
                    current.circle.defaultLeaveFromPlaceName?.takeIf { it.isNotBlank() }
                        ?: if (locatedPlaces.isEmpty()) {
                            "No located places yet"
                        } else {
                            "None"
                        },
                )
                FieldRowChevron()
            }
            DropdownMenu(
                expanded = defaultLeaveFromExpanded,
                onDismissRequest = { defaultLeaveFromExpanded = false },
            ) {
                DropdownMenuItem(
                    text = { Text("None") },
                    onClick = {
                        defaultLeaveFromExpanded = false
                        scope.launch {
                            model.setDefaultLeaveFrom(null)
                            refresh()
                        }
                    },
                    enabled = !current.loading,
                )
                locatedPlaces.forEach { place ->
                    DropdownMenuItem(
                        text = { Text(place.name) },
                        onClick = {
                            defaultLeaveFromExpanded = false
                            scope.launch {
                                model.setDefaultLeaveFrom(place.id)
                                refresh()
                            }
                        },
                        enabled = !current.loading,
                    )
                }
            }
        }
    }
}

@Composable
private fun CalendarDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val agendaListBusy = current.loading
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(FcSpaceXl),
    ) {
    Text("Agenda", style = MaterialTheme.typography.titleSmall)
    if (current.calendarRevalidating) {
        Text(
            text = "Updating…",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier =
                Modifier.semantics {
                    contentDescription = "agenda-revalidating"
                },
        )
    }
    // Cache miss first fetch: busy feedback lives on Load more → Loading… only.
    if (current.error != null) {
        Text(text = current.error, color = MaterialTheme.colorScheme.error)
    }
    if (current.circle.kids.isNotEmpty()) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            val allSelected = current.agendaKidFilter == null
            if (allSelected) {
                Button(
                    onClick = {
                        model.setAgendaKidFilter(null)
                        refresh()
                    },
                    enabled = !current.loading,
                ) {
                    Text("All kids")
                }
            } else {
                OutlinedButton(
                    onClick = {
                        model.setAgendaKidFilter(null)
                        refresh()
                    },
                    enabled = !current.loading,
                ) {
                    Text("All kids")
                }
            }
            current.circle.kids.forEach { kid ->
                val selected = current.agendaKidFilter == kid.id
                if (selected) {
                    Button(
                        onClick = {
                            model.setAgendaKidFilter(kid.id)
                            refresh()
                        },
                        enabled = !current.loading,
                    ) {
                        Text(kid.displayName)
                    }
                } else {
                    OutlinedButton(
                        onClick = {
                            model.setAgendaKidFilter(kid.id)
                            refresh()
                        },
                        enabled = !current.loading,
                    ) {
                        Text(kid.displayName)
                    }
                }
            }
        }
    }
    val visibleItems =
        if (current.agendaKidFilter == null) {
            current.calendarItems
        } else {
            current.calendarItems.filter { current.agendaKidFilter in it.kidIds }
        }
    if (visibleItems.isEmpty()) {
        // While the first calendar fetch (or Load more) is in flight, do not claim
        // the window is empty — busy feedback lives on Load more → Loading….
        if (!agendaListBusy) {
            Text(
                "No events in the loaded window.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    } else {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = FcSpaceMd),
            verticalArrangement = Arrangement.spacedBy(FcSpace2xl),
        ) {
        var pendingRsvpConfirm by remember { mutableStateOf<PendingRsvpConfirm?>(null) }
        pendingRsvpConfirm?.let { pending ->
            AlertDialog(
                onDismissRequest = { pendingRsvpConfirm = null },
                text = { Text(rsvpCoverageReleaseMessage(pending.kidName)) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            scope.launch {
                                model.setCalendarRsvp(
                                    pending.item,
                                    pending.kidId,
                                    pending.status,
                                )
                                pendingRsvpConfirm = null
                                refresh()
                            }
                        },
                    ) {
                        Text("OK")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { pendingRsvpConfirm = null }) {
                        Text("Cancel")
                    }
                },
            )
        }
        visibleItems.forEachIndexed { index, item ->
            val isManual = item.source == CalendarItemSource.MANUAL
            val outOfPlay = isAgendaItemOutOfPlay(item)
            val needsOrigin =
                item.leaveByStatus == LeaveByStatus.UNAVAILABLE &&
                    item.leaveByReason == "NO_ORIGIN"
            var leaveFromExpanded by remember(item.source, item.id) { mutableStateOf(false) }
            val itemCoverages = activeCoverages(item)
            val pendingForSelf = pendingCoverageForAdult(item, current.adultId)
            val uncoveredKidNames = eventKidNames(item.uncoveredKidIds, current.circle.kids)
            var assignAdultId by remember(item.source, item.id, current.adultId) {
                mutableStateOf(
                    defaultCoverageAdultId(current.adultId, current.circle.members),
                )
            }
            var assignKidIds by
                remember(item.source, item.id, item.uncoveredKidIds.joinToString(",")) {
                    mutableStateOf(defaultCoverageKidIds(item.uncoveredKidIds))
                }
            fun requestRsvpChange(
                kidId: String,
                kidName: String,
                status: RsvpStatus,
            ) {
                if (rsvpStatusForKid(item, kidId) == status) return
                val releasesCoverage =
                    (
                        status == RsvpStatus.NO ||
                            status == RsvpStatus.NO_RESPONSE
                    ) &&
                        kidHasActiveCoverage(item, kidId)
                if (releasesCoverage) {
                    pendingRsvpConfirm =
                        PendingRsvpConfirm(
                            item = item,
                            kidId = kidId,
                            status = status,
                            kidName = kidName,
                        )
                } else {
                    scope.launch {
                        model.setCalendarRsvp(item, kidId, status)
                        refresh()
                    }
                }
            }
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .alpha(if (outOfPlay) 0.7f else 1f)
                        .padding(bottom = if (index == visibleItems.lastIndex) 0.dp else FcSpaceXl),
                verticalArrangement = Arrangement.spacedBy(FcSpaceMd),
            ) {
                // agenda-band-primary — title / when / location
                Column(
                    modifier = Modifier.semantics { contentDescription = AgendaBands.PRIMARY },
                    verticalArrangement = Arrangement.spacedBy(FcSpaceXs),
                ) {
                    Text(
                        item.title,
                        style = MaterialTheme.typography.titleSmall,
                        color =
                            if (outOfPlay) {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                    )
                    Text(
                        formatEventWhen(item.startsAt, item.endsAt),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (!item.location.isNullOrBlank()) {
                        Text(
                            item.location!!,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    val conflictLines = conflictDisplayLines(item.conflicts, current.circle.kids)
                    if (!outOfPlay && conflictLines.isNotEmpty()) {
                        Column(
                            modifier =
                                Modifier.semantics {
                                    contentDescription =
                                        "agenda-conflicts-${item.source}-${item.id}"
                                },
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            conflictLines.forEach { line ->
                                Text(
                                    line,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFFB45309),
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                        }
                    }
                }

                // agenda-band-travel — leave-by + Leave from (+ Open Places)
                if (!outOfPlay) {
                Column(
                    modifier = Modifier.semantics { contentDescription = AgendaBands.TRAVEL },
                    verticalArrangement = Arrangement.spacedBy(FcSpaceSm),
                ) {
                    Text(
                        leaveByAgendaLine(item),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    val locatedPlaces = current.circle.places.filter { it.isLocated() }
                    if (locatedPlaces.size <= 1) {
                        FieldRow(label = FieldRowLabels.LEAVE_FROM) {
                            FieldRowValueText(
                                item.leaveFromPlaceName?.takeIf { it.isNotBlank() }
                                    ?: locatedPlaces.singleOrNull()?.name
                                    ?: if (current.circle.places.isEmpty()) {
                                        "No places yet"
                                    } else {
                                        "No located places yet"
                                    },
                            )
                        }
                    } else {
                        FieldRow(label = FieldRowLabels.LEAVE_FROM) {
                            Box {
                                Row(
                                    modifier =
                                        Modifier.clickable(
                                            enabled =
                                                !current.loading &&
                                                    current.circle.places.isNotEmpty(),
                                        ) {
                                            leaveFromExpanded = true
                                        },
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    FieldRowValueText(
                                        item.leaveFromPlaceName?.takeIf { it.isNotBlank() }
                                            ?: "Choose a located place",
                                    )
                                    FieldRowChevron()
                                }
                                DropdownMenu(
                                    expanded = leaveFromExpanded,
                                    onDismissRequest = { leaveFromExpanded = false },
                                ) {
                                    current.circle.places.forEach { place ->
                                        val located = place.isLocated()
                                        DropdownMenuItem(
                                            text = {
                                                Text(
                                                    if (located) {
                                                        place.name
                                                    } else {
                                                        "${place.name} (not located)"
                                                    },
                                                )
                                            },
                                            onClick = {
                                                if (!located) return@DropdownMenuItem
                                                leaveFromExpanded = false
                                                scope.launch {
                                                    model.setCalendarLeaveFrom(item, place.id)
                                                    refresh()
                                                }
                                            },
                                            enabled = located && !current.loading,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    if (needsOrigin) {
                        OutlinedButton(
                            onClick = {
                                model.openMorePlaces()
                                refresh()
                            },
                        ) {
                            Text("Open Places")
                        }
                    }
                }
                }

                // agenda-band-people — source + per-kid RSVP field rows
                Column(
                    modifier = Modifier.semantics { contentDescription = AgendaBands.PEOPLE },
                    verticalArrangement = Arrangement.spacedBy(FcSpaceSm),
                ) {
                    Text(
                        calendarSourceLabel(item.source, item.feedName),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    item.kidIds.forEach { kidId ->
                        val kidName =
                            current.circle.kids
                                .find { it.id == kidId }
                                ?.displayName
                                ?.trim()
                                ?.takeIf { it.isNotEmpty() }
                                ?: "Kid"
                        val currentStatus = rsvpStatusForKid(item, kidId)
                        var rsvpExpanded by remember(item.source, item.id, kidId) {
                            mutableStateOf(false)
                        }
                        FieldRow(label = kidName) {
                            Box {
                                Row(
                                    modifier =
                                        Modifier
                                            .clickable(enabled = !current.loading) {
                                                rsvpExpanded = true
                                            }
                                            .semantics {
                                                contentDescription =
                                                    "rsvp-${item.source}-${item.id}-$kidId"
                                            },
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    FieldRowValueText(rsvpStatusLabel(currentStatus))
                                    FieldRowChevron()
                                }
                                DropdownMenu(
                                    expanded = rsvpExpanded,
                                    onDismissRequest = { rsvpExpanded = false },
                                ) {
                                    listOf(
                                        RsvpStatus.NO_RESPONSE,
                                        RsvpStatus.YES,
                                        RsvpStatus.NO,
                                    ).forEach { status ->
                                        DropdownMenuItem(
                                            text = { Text(rsvpStatusLabel(status)) },
                                            onClick = {
                                                rsvpExpanded = false
                                                requestRsvpChange(kidId, kidName, status)
                                            },
                                            enabled = !current.loading,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // agenda-band-coverage — responsibility + situational CTAs
                if (!outOfPlay) {
                Column(
                    modifier = Modifier.semantics { contentDescription = AgendaBands.COVERAGE },
                    verticalArrangement = Arrangement.spacedBy(FcSpaceSm),
                ) {
                    if (itemCoverages.isNotEmpty()) {
                        itemCoverages.forEach { coverage ->
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    "${coverageAdultLabel(coverage, current.circle.members)} · " +
                                        "${coverageKidNames(coverage, current.circle.kids)} · " +
                                        coverageStatusLabel(coverage.status),
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.weight(1f),
                                )
                                OutlinedButton(
                                    onClick = {
                                        scope.launch {
                                            model.removeCoverage(coverage.id)
                                            refresh()
                                        }
                                    },
                                    enabled = !current.loading,
                                ) {
                                    Text("Remove coverage")
                                }
                            }
                        }
                    }
                    if (item.uncoveredKidIds.isNotEmpty()) {
                        Text(
                            buildString {
                                append("Needs coverage")
                                if (uncoveredKidNames.isNotEmpty()) {
                                    append(": $uncoveredKidNames")
                                }
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                    pendingForSelf?.let { pending ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        model.confirmCoverage(pending.id)
                                        refresh()
                                    }
                                },
                                enabled = !current.loading,
                                modifier =
                                    Modifier.semantics {
                                        contentDescription = AgendaBands.CTA_PRIMARY
                                    },
                            ) {
                                Text("Confirm coverage")
                            }
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        model.declineCoverage(pending.id)
                                        refresh()
                                    }
                                },
                                enabled = !current.loading,
                            ) {
                                Text("Decline coverage")
                            }
                        }
                    }
                    if (item.uncoveredKidIds.isNotEmpty() && current.circle.members.isNotEmpty()) {
                        val soleAdult = current.circle.members.size == 1
                        val soleKid = item.uncoveredKidIds.size == 1
                        val effectiveAdultId =
                            if (soleAdult) {
                                current.circle.members.first().adultId
                            } else {
                                assignAdultId
                            }
                        val effectiveKidIds =
                            if (soleKid) {
                                item.uncoveredKidIds
                            } else {
                                assignKidIds.toList()
                            }
                        if (!soleAdult) {
                            var assignAdultExpanded by remember(item.source, item.id) {
                                mutableStateOf(false)
                            }
                            FieldRow(label = FieldRowLabels.COVERING_ADULT) {
                                Box {
                                    Row(
                                        modifier =
                                            Modifier.clickable(enabled = !current.loading) {
                                                assignAdultExpanded = true
                                            },
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    ) {
                                        FieldRowValueText(
                                            current.circle.members
                                                .find { it.adultId == assignAdultId }
                                                ?.let(::memberLabel)
                                                ?: "Choose adult",
                                        )
                                        FieldRowChevron()
                                    }
                                    DropdownMenu(
                                        expanded = assignAdultExpanded,
                                        onDismissRequest = { assignAdultExpanded = false },
                                    ) {
                                        current.circle.members.forEach { member ->
                                            DropdownMenuItem(
                                                text = { Text(memberLabel(member)) },
                                                onClick = {
                                                    assignAdultId = member.adultId
                                                    assignAdultExpanded = false
                                                },
                                                enabled = !current.loading,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        if (!soleKid) {
                            Text("Uncovered kids", style = MaterialTheme.typography.labelSmall)
                            item.uncoveredKidIds.forEach { kidId ->
                                val kid = current.circle.kids.find { it.id == kidId } ?: return@forEach
                                Row(modifier = Modifier.fillMaxWidth()) {
                                    Checkbox(
                                        checked = kidId in assignKidIds,
                                        onCheckedChange = { checked ->
                                            // Toggling kids must not clear the covering-adult default.
                                            assignKidIds =
                                                if (checked) {
                                                    assignKidIds + kidId
                                                } else {
                                                    assignKidIds - kidId
                                                }
                                        },
                                        enabled = !current.loading,
                                    )
                                    Text(kid.displayName, modifier = Modifier.padding(top = 12.dp))
                                }
                            }
                        }
                        val assignModifier =
                            if (pendingForSelf == null) {
                                Modifier.semantics {
                                    contentDescription = AgendaBands.CTA_PRIMARY
                                }
                            } else {
                                Modifier
                            }
                        if (pendingForSelf == null) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        model.assignCoverage(
                                            item,
                                            effectiveAdultId,
                                            effectiveKidIds,
                                        )
                                        assignKidIds = defaultCoverageKidIds(item.uncoveredKidIds)
                                        refresh()
                                    }
                                },
                                enabled =
                                    !current.loading &&
                                        effectiveAdultId.isNotBlank() &&
                                        effectiveKidIds.isNotEmpty(),
                                modifier = assignModifier,
                            ) {
                                Text("Assign coverage")
                            }
                        } else {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        model.assignCoverage(
                                            item,
                                            effectiveAdultId,
                                            effectiveKidIds,
                                        )
                                        assignKidIds = defaultCoverageKidIds(item.uncoveredKidIds)
                                        refresh()
                                    }
                                },
                                enabled =
                                    !current.loading &&
                                        effectiveAdultId.isNotBlank() &&
                                        effectiveKidIds.isNotEmpty(),
                            ) {
                                Text("Assign coverage")
                            }
                        }
                    }
                    current.coverageActionErrors[agendaCoverageItemKey(item)]?.let { message ->
                        Text(
                            text = message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            modifier =
                                Modifier.semantics {
                                    contentDescription =
                                        "agenda-coverage-error-${item.source.name}-${item.id}"
                                },
                        )
                    }
                }
                }

                if (isManual) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier =
                            Modifier.semantics {
                                contentDescription = AgendaBands.MANUAL_ACTIONS
                            },
                    ) {
                        OutlinedButton(
                            onClick = {
                                model.beginEditEvent(item)
                                refresh()
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Edit")
                        }
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    model.removeEvent(item.id)
                                    refresh()
                                }
                            },
                            enabled = !current.loading,
                        ) {
                            Text("Remove event")
                        }
                    }
                }
                if (index != visibleItems.lastIndex) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                }
            }
        }
        }
    }

    OutlinedButton(
        onClick = {
            scope.launch {
                model.loadMoreCalendar()
                refresh()
            }
        },
        enabled = !current.loading,
        modifier = Modifier.fillMaxWidth(),
    ) {
        BusyButtonLabel(
            busy = agendaListBusy,
            idle = "Load more",
            busyLabel = AppShell.BUSY_LOADING,
        )
    }
    }
}

@Composable
private fun BusyButtonLabel(
    busy: Boolean,
    idle: String,
    busyLabel: String,
) {
    if (busy) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(FcSpaceSm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
            )
            Text(busyLabel)
        }
    } else {
        Text(idle)
    }
}

@Composable
private fun EventComposeDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val editing = current.editingEventId != null
    Text(
        if (editing) "Edit event" else "Add event",
        style = MaterialTheme.typography.titleSmall,
    )
    if (current.error != null) {
        Text(text = current.error, color = MaterialTheme.colorScheme.error)
    }
    if (editing) {
        OutlinedTextField(
            value = current.editingEventTitle,
            onValueChange = {
                model.updateEditingEventTitle(it)
                refresh()
            },
            label = { Text("Event title") },
            singleLine = true,
            enabled = !current.loading,
            modifier = Modifier.fillMaxWidth(),
        )
        InstantDateTimeField(
            label = "Event start",
            isoValue = current.editingEventStartsAt,
            onIsoChange = {
                model.updateEditingEventStartsAt(it)
                refresh()
            },
            enabled = !current.loading,
            minEpochMillis = nowEpochMillis(),
        )
        InstantDateTimeField(
            label = "Event end (optional)",
            isoValue = current.editingEventEndsAt,
            onIsoChange = {
                model.updateEditingEventEndsAt(it)
                refresh()
            },
            enabled = !current.loading,
            optional = true,
            minEpochMillis =
                maxOf(
                    nowEpochMillis(),
                    parseIsoToEpochMillis(current.editingEventStartsAt) ?: nowEpochMillis(),
                ),
        )
        OutlinedTextField(
            value = current.editingEventLocation,
            onValueChange = {
                model.updateEditingEventLocation(it)
                refresh()
            },
            label = { Text("Event location (optional)") },
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
                BusyButtonLabel(
                    busy = current.loading,
                    idle = "Save",
                    busyLabel = AppShell.BUSY_SAVING,
                )
            }
            OutlinedButton(
                onClick = {
                    model.closeEventCompose()
                    refresh()
                },
                enabled = !current.loading,
            ) {
                Text("Cancel")
            }
        }
    } else {
        OutlinedTextField(
            value = current.newEventTitle,
            onValueChange = {
                model.updateNewEventTitle(it)
                refresh()
            },
            label = { Text("Event title") },
            singleLine = true,
            enabled = !current.loading,
            modifier = Modifier.fillMaxWidth(),
        )
        InstantDateTimeField(
            label = "Event start",
            isoValue = current.newEventStartsAt,
            onIsoChange = {
                model.updateNewEventStartsAt(it)
                refresh()
            },
            enabled = !current.loading,
            minEpochMillis = nowEpochMillis(),
        )
        InstantDateTimeField(
            label = "Event end (optional)",
            isoValue = current.newEventEndsAt,
            onIsoChange = {
                model.updateNewEventEndsAt(it)
                refresh()
            },
            enabled = !current.loading,
            optional = true,
            minEpochMillis =
                maxOf(
                    nowEpochMillis(),
                    parseIsoToEpochMillis(current.newEventStartsAt) ?: nowEpochMillis(),
                ),
        )
        OutlinedTextField(
            value = current.newEventLocation,
            onValueChange = {
                model.updateNewEventLocation(it)
                refresh()
            },
            label = { Text("Event location (optional)") },
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
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
            ) {
                BusyButtonLabel(
                    busy = current.loading,
                    idle = "Save",
                    busyLabel = AppShell.BUSY_SAVING,
                )
            }
            OutlinedButton(
                onClick = {
                    model.closeEventCompose()
                    refresh()
                },
                enabled = !current.loading,
            ) {
                Text("Cancel")
            }
        }
    }
}

@Composable
private fun FeedsDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
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
    current.carpoolError?.let { message ->
        Text(text = message, color = MaterialTheme.colorScheme.error)
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
                    if (current.carpoolSummary != null) {
                        CarpoolFeedActionsRow(
                            feed =
                                carpoolStatusForFeed(
                                    current.carpoolSummary,
                                    feed.id,
                                    feed.name,
                                ),
                            circleRole = current.circle.role,
                            disabled = current.loading || current.carpoolLoading,
                            onEnable = {
                                scope.launch {
                                    model.enableCarpool(feed.id)
                                    refresh()
                                }
                            },
                            onRequest = { spaceId ->
                                scope.launch {
                                    model.requestCarpool(spaceId)
                                    refresh()
                                }
                            },
                            onOpen = {
                                model.selectShellTab(FamilyUiModel.ShellTab.CARPOOL)
                                refresh()
                            },
                        )
                    }
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
