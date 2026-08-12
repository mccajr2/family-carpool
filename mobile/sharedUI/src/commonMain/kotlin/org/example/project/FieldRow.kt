package org.example.project

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.example.project.ui.UiIcons
import org.example.project.ui.UiTokens

/** Contract strings for single-value field rows (agenda-coverage-web-contract). */
object FieldRowLabels {
    const val LEAVE_FROM = "Leave from"
    const val COVERING_ADULT = "Covering adult"
    const val DEFAULT_LEAVE_FROM = "My default leave-from"
}

/**
 * Settings-style single-value field: label leading, value trailing.
 * See docs/agenda-coverage-web-contract.md — Field rows.
 */
@Composable
fun FieldRow(
    label: String,
    modifier: Modifier = Modifier,
    valueContent: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
            content = valueContent,
        )
    }
}

@Composable
fun FieldRowValueText(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        textAlign = TextAlign.End,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}

@Composable
fun FieldRowChevron(modifier: Modifier = Modifier) {
    Icon(
        imageVector = UiIcons.imageVector(UiTokens.Icon.chevron),
        contentDescription = null,
        modifier = modifier,
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
