package com.tango.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tango.app.data.MessageRecord

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReviewScreen(message: MessageRecord, explanation: () -> Unit, share: () -> Unit, correct: () -> Unit, animation: (() -> Unit)? = null) {
    var confirmCorrection by rememberSaveable { mutableStateOf(false) }
    Heading("Message review", if (message.corrected) "A second look.\nYour correction." else "Pause before you pay.")
    Badge(if (message.isDemo) "Fictional message · demo" else "Real notification · local checks", Pink, PinkTint)
    if (animation != null) TextAction("Replay warning animation", animation)
    Panel(if (message.corrected) GreenTint else AmberTint) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(if (message.corrected) AppIcons.CheckCircle else AppIcons.WarningAmber, null, tint = if (message.corrected) Green else Amber)
            Text(if (message.corrected) "Marked as not a scam" else "Suspected scam", color = if (message.corrected) Green else Amber, style = MaterialTheme.typography.titleLarge)
        }
        Text(if (message.corrected) "You marked this as not a scam. The Tango flag was removed. The original SMS is unchanged."
            else message.clues.joinToString(" ") { it.title + "." } + " Review the clues before responding.", style = MaterialTheme.typography.bodyLarge)
        Text("${if (message.isDemo) "Demo check" else "Local check"} · ${message.time}", color = if (message.corrected) Green else Amber, style = MaterialTheme.typography.bodySmall)
    }
    Panel {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Messaging notification preview", color = Muted, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
            Badge(if (message.isDemo) "Unfamiliar sender" else "Notification sender")
        }
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(message.sender, style = MaterialTheme.typography.titleLarge)
            Body(message.time)
        }
        Text(message.displayPreview, style = MaterialTheme.typography.bodyLarge)
        message.neutralizedLink?.let { link ->
            Panel(Background) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(AppIcons.LinkOff, null, tint = Muted)
                    Text("LINK DISABLED", color = Muted, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                }
                // Plain Text deliberately has no link annotation or click handler.
                Text(link, color = Muted, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Body("Links are neutralized for review. The original message remains in your messaging inbox.")
        if (!message.isDemo) Body(message.protectionAction)
    }
    if (message.tags.isNotEmpty()) {
        Text("What stood out", style = MaterialTheme.typography.titleLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            message.tags.forEach { Badge(it, Pink, PinkTint) }
        }
    }
    PrimaryButton("Why it was flagged", AppIcons.ArrowForward, onClick = explanation)
    if (!message.corrected) {
        SecondaryButton("Share threat", AppIcons.Share, share)
        TextButton(onClick = { confirmCorrection = true }, modifier = Modifier.fillMaxWidth()) { Text("Mark as not a scam") }
    }
    if (confirmCorrection) AlertDialog(onDismissRequest = { confirmCorrection = false },
        title = { Text("Mark as not a scam?") },
        text = { Text("This removes the Tango flag from this record and updates the local hornets total. It does not change the original SMS or disable protection permissions.") },
        confirmButton = { TextButton(onClick = { correct(); confirmCorrection = false }) { Text("Mark as not a scam") } },
        dismissButton = { TextButton(onClick = { confirmCorrection = false }) { Text("Cancel") } })
}

@Composable
fun ExplanationScreen(message: MessageRecord, back: () -> Unit) {
    val uri = LocalUriHandler.current
    var linkError by remember { mutableStateOf(false) }
    Heading("Understand the warning", "The clues, not just a label.", "${message.title} · ${message.time}")
    Body("${message.domain ?: "No link in message"} · ${if (message.domain == null) "No link check" else "Link disabled"}")
    Panel {
        Badge("Language & link indicators", Amber, AmberTint)
        message.clues.forEach { clue ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(clue.title, style = MaterialTheme.typography.titleMedium)
                Body(clue.detail)
            }
        }
    }
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(AppIcons.QrCodeScanner, null, tint = Pink)
            Text("Link checks", style = MaterialTheme.typography.titleMedium)
        }
        Text(if (message.domain == null) "Reputation · Not applicable" else if (message.isDemo) "Reputation · Simulated list hit" else "Reputation · Not checked", style = MaterialTheme.typography.titleMedium)
        Body(if (message.domain == null) "No link is present in this message, so there is no domain reputation result."
            else if (message.isDemo) "In this demo, the domain matches a known-bad entry. This is a fictional finding, not a live threat report."
            else "No reputation service was contacted. The warning is based only on local notification-preview indicators.")
        Text("Domain age · ${if (message.domain == null) "Not applicable" else if (message.isDemo) "Unavailable" else "Not checked"}", style = MaterialTheme.typography.titleMedium)
        Body("No age result. An unavailable check adds no evidence of a threat.")
        Body(if (message.isDemo) "Cloud classifier: not run. All findings on this screen are demo examples." else "On-device heuristics only. No message content was sent to a server. These indicators can be wrong; review the message before deciding.")
    }
    Panel(GreenTint) {
        Text(message.adviceTitle, color = Green, style = MaterialTheme.typography.titleMedium)
        Body(message.advice, Green)
    }
    Panel {
        Eyebrow("T-Mobile · Call protection")
        Text("Since you’re a T-Mobile user, here are services that can help.", style = MaterialTheme.typography.titleLarge)
        listOf("Scam Shield" to "Explore T-Mobile’s scam-protection offering and available setup options.",
            "Scam ID" to "Learn about identifying suspected scam calls before answering.",
            "Scam Block" to "Explore options for blocking suspected scam calls.").forEach { (title, text) ->
            HorizontalDivider(color = Line)
            Text(title, style = MaterialTheme.typography.titleMedium)
            Body(text)
        }
        Body("These services provide call protection, not analysis of this text. They do not delete SMS, scan websites or stop every scam call. Availability and eligibility vary.")
        TextAction("Official guide ↗\nt-mobile.com/benefits/scam-shield") {
            try { uri.openUri("https://www.t-mobile.com/benefits/scam-shield") } catch (_: Exception) { linkError = true }
        }
        if (linkError) Body("No browser is available. Open t-mobile.com/benefits/scam-shield on another device.")
    }
    SecondaryButton("Back to message review", onClick = back)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ShareScreen(message: MessageRecord, cancel: () -> Unit, confirm: () -> Unit) {
    var confirmed by rememberSaveable(message.id) { mutableStateOf(false) }
    val preview = message.sharingPreview()
    Heading("Community · optional", "One warning can help others.")
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        CharacterAvatar(40)
        Text("Hornet’s Nest", style = MaterialTheme.typography.titleLarge)
    }
    if (preview == null) {
        Panel(GreenTint) { Body("Corrected records and records without a suspicious domain cannot be shared as threats.", Green) }
        SecondaryButton("Back to message review", onClick = cancel)
        return
    }
    Panel {
        Badge("Sharing preview")
        Eyebrow("Suspicious domain", Muted)
        Text(preview.domain, style = MaterialTheme.typography.titleMedium)
        Eyebrow("Scam category", Muted)
        Text(preview.category, style = MaterialTheme.typography.titleMedium)
        Eyebrow("Reason tags", Muted)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            preview.reasonTags.forEach { Badge(it, Pink, PinkTint) }
        }
    }
    Panel(GreenTint) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(AppIcons.VisibilityOff, null, tint = Green)
            Text("Personal details stay out", color = Green, style = MaterialTheme.typography.titleMedium)
        }
        listOf("Sender" to "Redacted · not shared", "Names & personal details" to "Removed · not shared", "Raw message text" to "Excluded").forEach { (title, status) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(title, color = Green, style = MaterialTheme.typography.bodySmall)
                Text(status, color = Green, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            }
        }
    }
    Text("Your choice, for this threat only", style = MaterialTheme.typography.titleMedium)
    Body("The planned Spacetime integration sends only the domain, category and reason tags above. Future messages won’t be shared automatically. Sharing is separate from cloud-analysis consent and adds no extra hornet.")
    Badge("Frontend demo · no upload", Pink, PinkTint)
    Body("This build has no connected sharing backend. Confirming lets you preview the flow; no threat information is transmitted.")
    if (confirmed) Panel(GreenTint) {
        Text("Demo preview confirmed", color = Green, style = MaterialTheme.typography.titleMedium)
        Body("Nothing was uploaded. Your hornets total and original message are unchanged.", Green)
    }
    PrimaryButton(if (confirmed) "Demo preview confirmed" else "Confirm & share threat", AppIcons.Share, enabled = !confirmed) {
        confirmed = true
        confirm()
    }
    SecondaryButton(if (confirmed) "Back to message review" else "Cancel", onClick = cancel)
}
