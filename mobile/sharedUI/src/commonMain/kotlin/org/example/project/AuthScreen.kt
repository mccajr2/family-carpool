package org.example.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeContentPadding
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun App(
    session: AuthSession,
    calendarCacheStore: CalendarCacheStore = InMemoryCalendarCacheStore(),
    bootstrapCacheStore: FamilyBootstrapCache = InMemoryFamilyBootstrapCache(),
) {
    MaterialTheme {
        AuthScreen(
            session = session,
            calendarCacheStore = calendarCacheStore,
            bootstrapCacheStore = bootstrapCacheStore,
        )
    }
}

@Composable
fun AuthScreen(
    session: AuthSession,
    calendarCacheStore: CalendarCacheStore = InMemoryCalendarCacheStore(),
    bootstrapCacheStore: FamilyBootstrapCache = InMemoryFamilyBootstrapCache(),
) {
    val model = remember(session) { AuthUiModel(session) }
    var state by remember { mutableStateOf(model.state) }
    val scope = rememberCoroutineScope()

    fun refresh() {
        state = model.state
    }

    LaunchedEffect(session) {
        model.restoreIfSignedIn()
        refresh()
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .safeContentPadding()
                .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when (val current = state) {
            is AuthUiModel.State.SignedIn -> {
                // Once signed in, FamilyScreen reports its own load failures — repeating
                // current.error here printed the same connectivity message twice.
                FamilyScreen(
                    session = session,
                    calendarCacheStore = calendarCacheStore,
                    bootstrapCacheStore = bootstrapCacheStore,
                    onSignOut = {
                        scope.launch {
                            model.signOut()
                            refresh()
                        }
                    },
                )
            }

            is AuthUiModel.State.SignedOut -> {
                Text("Sign in", style = MaterialTheme.typography.headlineSmall)
                Text(
                    text = "Email one-time code",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
                )
                OutlinedTextField(
                    value = current.email,
                    onValueChange = {
                        model.updateEmail(it)
                        refresh()
                    },
                    label = { Text("Email") },
                    singleLine = true,
                    enabled = !current.loading,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (current.codeSent) {
                    OutlinedTextField(
                        value = current.code,
                        onValueChange = {
                            model.updateCode(it)
                            refresh()
                        },
                        label = { Text("One-time code") },
                        singleLine = true,
                        enabled = !current.loading,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                    )
                    if (current.devHint != null) {
                        Text(
                            text = "Dev code echo: ${current.devHint}",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Button(
                        onClick = {
                            scope.launch {
                                model.verifyCode()
                                refresh()
                            }
                        },
                        enabled = !current.loading && current.code.isNotBlank(),
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp),
                    ) {
                        Text(if (current.loading) "Verifying…" else "Verify code")
                    }
                } else {
                    Button(
                        onClick = {
                            scope.launch {
                                model.sendCode()
                                refresh()
                            }
                        },
                        enabled = !current.loading && current.email.isNotBlank(),
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp),
                    ) {
                        Text(if (current.loading) "Sending…" else "Send code")
                    }
                }
                if (current.loading) {
                    CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
                }
                if (current.error != null) {
                    Text(
                        text = current.error,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }
    }
}
