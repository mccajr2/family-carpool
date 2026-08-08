package org.example.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
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

            is FamilyUiModel.State.NeedsCreate -> {
                Text("Create your family", style = MaterialTheme.typography.headlineSmall)
                Text(
                    text = "Signed in as ${current.email.ifBlank { "…" }}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                OutlinedTextField(
                    value = current.adultDisplayName,
                    onValueChange = {
                        model.updateAdultDisplayName(it)
                        refresh()
                    },
                    label = { Text("Your display name") },
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
                    label = { Text("Family name (optional)") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (current.error != null) {
                    Text(text = current.error, color = MaterialTheme.colorScheme.error)
                }
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
                    onClick = onSignOut,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Sign out")
                }
            }

            is FamilyUiModel.State.Ready -> {
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
                if (current.circle.kids.isEmpty()) {
                    Text("No kids yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    current.circle.kids.forEach { kid ->
                        if (current.editingKidId == kid.id) {
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
                if (current.error != null) {
                    Text(text = current.error, color = MaterialTheme.colorScheme.error)
                }
                if (current.loading) {
                    CircularProgressIndicator()
                }
                OutlinedButton(
                    onClick = onSignOut,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Sign out")
                }
            }
        }
    }
}
