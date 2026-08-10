package org.example.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerDialog
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

private enum class InstantPickerStep {
    Hidden,
    Date,
    Time,
}

/**
 * Date + time picker that reads/writes ISO-8601 UTC instant strings for the API.
 * Dates/times before [minEpochMillis] cannot be confirmed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstantDateTimeField(
    label: String,
    isoValue: String,
    onIsoChange: (String) -> Unit,
    enabled: Boolean,
    optional: Boolean = false,
    minEpochMillis: Long = nowEpochMillis(),
) {
    var step by remember { mutableStateOf(InstantPickerStep.Hidden) }
    var pendingDateMillis by remember { mutableStateOf<Long?>(null) }
    var pickerError by remember { mutableStateOf<String?>(null) }

    val display =
        when {
            isoValue.isBlank() && optional -> "Not set"
            isoValue.isBlank() -> "Pick date & time"
            else -> formatIsoForDisplay(isoValue)
        }

    val selectableDates =
        remember(minEpochMillis) {
            object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                    utcTimeMillis >= utcMidnightMillisForLocalDay(minEpochMillis)
            }
        }

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Text(display, style = MaterialTheme.typography.bodyMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = {
                    pickerError = null
                    step = InstantPickerStep.Date
                },
                enabled = enabled,
            ) {
                Text(if (isoValue.isBlank()) "Set" else "Change")
            }
            if (optional && isoValue.isNotBlank()) {
                OutlinedButton(
                    onClick = { onIsoChange("") },
                    enabled = enabled,
                ) {
                    Text("Clear")
                }
            }
        }
        if (pickerError != null) {
            Text(pickerError!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }

    if (step == InstantPickerStep.Date) {
        val seed =
            (parseIsoToEpochMillis(isoValue) ?: minEpochMillis).coerceAtLeast(minEpochMillis)
        val dateState =
            rememberDatePickerState(
                initialSelectedDateMillis = utcMidnightMillisForLocalDay(seed),
                selectableDates = selectableDates,
            )
        DatePickerDialog(
            onDismissRequest = { step = InstantPickerStep.Hidden },
            confirmButton = {
                TextButton(
                    onClick = {
                        val selected = dateState.selectedDateMillis
                        if (selected != null) {
                            pendingDateMillis = selected
                            step = InstantPickerStep.Time
                        }
                    },
                ) {
                    Text("Next")
                }
            },
            dismissButton = {
                TextButton(onClick = { step = InstantPickerStep.Hidden }) {
                    Text("Cancel")
                }
            },
        ) {
            DatePicker(state = dateState)
        }
    }

    if (step == InstantPickerStep.Time) {
        val seedMillis =
            (parseIsoToEpochMillis(isoValue) ?: minEpochMillis).coerceAtLeast(minEpochMillis)
        val (hour, minute) = localHourMinute(seedMillis)
        val timeState =
            rememberTimePickerState(
                initialHour = hour,
                initialMinute = minute,
                is24Hour = false,
            )
        TimePickerDialog(
            onDismissRequest = {
                pendingDateMillis = null
                step = InstantPickerStep.Hidden
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val dateMillis = pendingDateMillis
                        if (dateMillis != null) {
                            val combined =
                                combineUtcDateAndLocalTime(
                                    dateMillis,
                                    timeState.hour,
                                    timeState.minute,
                                )
                            if (combined < minEpochMillis) {
                                pickerError = "Pick a time in the future"
                                pendingDateMillis = null
                                step = InstantPickerStep.Hidden
                                return@TextButton
                            }
                            pickerError = null
                            onIsoChange(epochMillisToIsoUtc(combined))
                        }
                        pendingDateMillis = null
                        step = InstantPickerStep.Hidden
                    },
                ) {
                    Text("OK")
                }
            },
            title = { Text("Select time") },
            dismissButton = {
                TextButton(
                    onClick = {
                        pendingDateMillis = null
                        step = InstantPickerStep.Hidden
                    },
                ) {
                    Text("Cancel")
                }
            },
        ) {
            TimePicker(state = timeState)
        }
    }
}
