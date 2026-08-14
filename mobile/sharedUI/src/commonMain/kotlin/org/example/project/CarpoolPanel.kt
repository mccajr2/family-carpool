package org.example.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
internal fun CarpoolDestination(
    current: FamilyUiModel.State.Ready,
    model: FamilyUiModel,
    refresh: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val summary = current.carpoolSummary
    val busy = current.carpoolLoading
    Text(AppShell.TAB_CARPOOL, style = MaterialTheme.typography.headlineSmall)
    if (summary == null && current.carpoolError == null) {
        Text(AppShell.CARPOOL_LOADING, style = MaterialTheme.typography.bodyMedium)
    }
    if (summary != null && summary.hasNoCarpools()) {
        Text(summary.emptyHint(), style = MaterialTheme.typography.bodyMedium)
    }
    if (summary != null && summary.feeds.isNotEmpty()) {
        summary.feeds.forEach { feed ->
            Text(feed.feedName, style = MaterialTheme.typography.titleSmall)
            CarpoolFeedActionsRow(
                feed = feed,
                circleRole = summary.circleRole,
                disabled = busy,
                onEnable = {
                    scope.launch {
                        model.enableCarpool(feed.feedId)
                        refresh()
                    }
                },
                onRequest = { spaceId ->
                    scope.launch {
                        model.requestCarpool(spaceId)
                        refresh()
                    }
                },
                onOpen = { },
            )
        }
    }
    if (current.carpoolShowCodeForm) {
        OutlinedTextField(
            value = current.carpoolCodeInput,
            onValueChange = {
                model.updateCarpoolCodeInput(it)
                refresh()
            },
            label = { Text("Carpool invite code") },
            singleLine = true,
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    scope.launch {
                        model.joinCarpool()
                        refresh()
                    }
                },
                enabled = !busy && current.carpoolCodeInput.isNotBlank(),
            ) {
                Text("Join")
            }
            OutlinedButton(
                onClick = {
                    model.setCarpoolShowCodeForm(false)
                    refresh()
                },
                enabled = !busy,
            ) {
                Text("Cancel")
            }
        }
    } else {
        OutlinedButton(
            onClick = {
                model.setCarpoolShowCodeForm(true)
                refresh()
            },
            enabled = !busy,
        ) {
            Text(AppShell.CARPOOL_HAVE_A_CODE)
        }
    }
    if (summary != null && summary.spaces.isNotEmpty()) {
        Text("Your carpools", style = MaterialTheme.typography.titleSmall)
        summary.spaces.forEach { space ->
            CarpoolSpaceCard(
                space = space,
                busy = busy,
                onRegenerate = {
                    scope.launch {
                        model.regenerateCarpoolInvite(space.id)
                        refresh()
                    }
                },
                onLeave = {
                    scope.launch {
                        model.leaveCarpool(space.id)
                        refresh()
                    }
                },
                onAdmit = { requestId ->
                    scope.launch {
                        model.admitCarpoolRequest(space.id, requestId)
                        refresh()
                    }
                },
                onDecline = { requestId ->
                    scope.launch {
                        model.declineCarpoolRequest(space.id, requestId)
                        refresh()
                    }
                },
            )
        }
    }
    current.carpoolError?.let { message ->
        Text(text = message, color = MaterialTheme.colorScheme.error)
    }
}

@Composable
internal fun CarpoolFeedActionsRow(
    feed: CarpoolFeedStatus,
    circleRole: FamilyRole,
    disabled: Boolean,
    onEnable: () -> Unit,
    onRequest: (String) -> Unit,
    onOpen: (String) -> Unit,
) {
    var confirmEnable by remember(feed.feedId) { mutableStateOf(false) }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(feed.status.statusLabel(), style = MaterialTheme.typography.bodySmall)
        when (feed.primaryAction(circleRole)) {
            CarpoolPrimaryAction.ENABLE ->
                Button(
                    onClick = { confirmEnable = true },
                    enabled = !disabled,
                ) {
                    Text(AppShell.CARPOOL_ENABLE)
                }
            CarpoolPrimaryAction.REQUEST ->
                Button(
                    onClick = { feed.spaceId?.let(onRequest) },
                    enabled = !disabled,
                ) {
                    Text(AppShell.CARPOOL_REQUEST)
                }
            CarpoolPrimaryAction.OPEN ->
                OutlinedButton(
                    onClick = { feed.spaceId?.let(onOpen) },
                    enabled = !disabled,
                ) {
                    Text(AppShell.CARPOOL_OPEN)
                }
            CarpoolPrimaryAction.NONE -> Unit
        }
    }
    if (confirmEnable) {
        AlertDialog(
            onDismissRequest = { confirmEnable = false },
            title = { Text(AppShell.CARPOOL_ENABLE) },
            text = { Text(enableCarpoolConfirmMessage(feed.feedName)) },
            confirmButton = {
                Button(
                    onClick = {
                        confirmEnable = false
                        onEnable()
                    },
                ) {
                    Text(AppShell.CARPOOL_ENABLE)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmEnable = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun CarpoolSpaceCard(
    space: CarpoolSpace,
    busy: Boolean,
    onRegenerate: () -> Unit,
    onLeave: () -> Unit,
    onAdmit: (String) -> Unit,
    onDecline: (String) -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(space.name, style = MaterialTheme.typography.titleSmall)
        Text(
            if (space.membership == CarpoolSpaceMembership.OWNER) {
                "Owned by this family"
            } else {
                "Member"
            },
            style = MaterialTheme.typography.bodySmall,
        )
        Text(
            "Families: " + space.members.joinToString(", ") { circleDisplayName(it.circleName) },
            style = MaterialTheme.typography.bodySmall,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(space.inviteCode, style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(
                onClick = { clipboard.setText(AnnotatedString(space.inviteCode)) },
                enabled = !busy,
            ) {
                Text("Copy code")
            }
            if (space.membership == CarpoolSpaceMembership.OWNER) {
                OutlinedButton(onClick = onRegenerate, enabled = !busy) {
                    Text("Regenerate")
                }
            }
            OutlinedButton(onClick = onLeave, enabled = !busy) {
                Text("Leave")
            }
        }
        if (space.membership == CarpoolSpaceMembership.OWNER && space.pendingRequests.isNotEmpty()) {
            space.pendingRequests.forEach { request ->
                Text(request.displayLabel(), style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { onAdmit(request.id) }, enabled = !busy) {
                        Text("Admit")
                    }
                    OutlinedButton(onClick = { onDecline(request.id) }, enabled = !busy) {
                        Text("Decline")
                    }
                }
            }
        }
    }
}
