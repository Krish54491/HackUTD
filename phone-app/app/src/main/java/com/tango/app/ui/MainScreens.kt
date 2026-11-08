package com.tango.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tango.app.data.*

@Composable
fun SetupScreen(alerts: Boolean, access: Boolean, requestAlerts: () -> Unit, openAccess: () -> Unit,
                vpn: () -> Unit, later: () -> Unit, preview: () -> Unit) {
    Heading("Protection setup", "A second look.\nBefore you tap.")
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("${listOf(alerts, access).count { it }} of 2 required permissions ready", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        Body(if (alerts && access) "Permissions ready" else "Not active yet")
    }
    PermissionCard(AppIcons.NotificationsActive, "Show Tango alerts", if (alerts) "Allowed" else "Needed", alerts,
        "Warnings can appear when a message looks suspicious. ${if (alerts) "You’ve allowed this permission." else "Allow Tango to show warning notifications."}",
        if (alerts) "Manage Android alerts ↗" else "Allow warning alerts ↗", requestAlerts)
    PermissionCard(AppIcons.ChatBubbleOutline, "Notification access", if (access) "Allowed" else "Needed", access,
        "Android grants access to notifications, which may include sender names, message previews and personal details. Tango checks only previews Android makes available and saves flagged previews locally.",
        "Manage notification access ↗", openAccess)
    PermissionCard(AppIcons.Shield, "Malicious-link protection", "Optional", false,
        "Use a local VPN to filter known-bad domains. It adds a layer of protection, but cannot block every threat. VPN integration is not connected in this frontend.",
        "Set up local VPN →", vpn)
    PrimaryButton("Open notification access", AppIcons.Settings, onClick = openAccess)
    TextButton(onClick = later, modifier = Modifier.fillMaxWidth()) { Text("Set up later") }
    HorizontalDivider(color = Line)
    Body("Explore the screens with fictional messages and simulated protection states. No real messages are scanned.")
    SecondaryButton("Preview demo protection", AppIcons.PlayArrow, preview)
}

@Composable
private fun PermissionCard(icon: ImageVector, title: String, status: String, active: Boolean, text: String,
                           action: String, onClick: () -> Unit) {
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, null, tint = if (active) Green else Pink, modifier = Modifier.size(24.dp))
            Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
            Badge(status, if (active) Green else Muted, if (active) GreenTint else Background)
        }
        Body(text)
        TextAction(action, onClick)
    }
}

@Composable
fun HomeScreen(records: List<MessageRecord>, demo: Boolean, alerts: Boolean, access: Boolean,
               review: (String) -> Unit, history: () -> Unit, setup: () -> Unit, demoNotification: () -> Unit, previewWarning: ((MessageRisk) -> Unit)? = null,
               monitoringConnected: Boolean = false, monitoringError: String? = null, showReal: (() -> Unit)? = null) {
    Heading("Your protection", if (demo) "On guard. In the\nbackground." else "Your protection,\nat a glance.")
    Badge(if (demo) "Demo messages · simulated findings" else "Real messages · on-device checks", Pink, PinkTint)
    if (monitoringError != null) Panel(AmberTint) { Body(monitoringError, Amber) }
    if (demo && showReal != null) SecondaryButton("Show real messages", onClick = showReal)
    Panel {
        StatusRow(AppIcons.NotificationsActive, "Notification monitoring",
            if (demo) "Simulated access & warning alerts" else if (!access) "Notification access needed" else if (!monitoringConnected) "Waiting for Android to connect" else if (!alerts) "Connected · warning alerts unavailable" else "Local notification checks running",
            if (demo) "Demo" else if (!access || !alerts) "Needed" else if (monitoringConnected) "Active" else "Waiting", demo || (access && alerts && monitoringConnected))
        StatusRow(AppIcons.Shield, "Suspicious-domain filtering",
            if (demo) "Simulated local VPN connection" else "Local VPN not connected",
            if (demo) "Demo" else "Off", demo)
    }
    if (!demo) TextAction("Review protection setup →", setup)
    HornetsCard(records.hornetsDefeated(), period = if (demo) "DEMO · NOVEMBER SO FAR" else "SAVED HISTORY · ON THIS PHONE",
        detail = if (demo) "Demo attempts interrupted. Each counts once." else "Saved, unique warned attempts. Each counts once.")
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("Recent flagged messages", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
        TextAction("View all", history)
    }
    val recent = records.filterNot { it.corrected }.take(2)
    recent.forEach { message ->
        Row(Modifier.fillMaxWidth().clickable { review(message.id) }.padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(color = PinkTint, shape = MaterialTheme.shapes.medium) {
                Icon(AppIcons.SmsFailed, null, Modifier.padding(12.dp).size(22.dp), tint = Pink)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(message.title, style = MaterialTheme.typography.titleMedium)
                Body(message.domain ?: "No link in message")
                Text(message.time, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
            Icon(AppIcons.ChevronRight, "Review ${message.title}", tint = Muted)
        }
        HorizontalDivider(color = Line)
    }
    if (recent.isEmpty()) Body("No flagged messages. Your corrections are reflected in History.")
    SecondaryButton("Show demo warning notification", AppIcons.Notifications, demoNotification)
    if (previewWarning != null) {
        Text("Animation previews", style = MaterialTheme.typography.titleLarge)
        SecondaryButton("Preview medium-risk animation") { previewWarning(MessageRisk.MEDIUM) }
        SecondaryButton("Preview high-risk animation") { previewWarning(MessageRisk.HIGH) }
    }

    Body(if (demo) "Fictional records are shown here. Real monitoring, when enabled, continues independently; choose Show real messages to see its records."
        else "Only flagged notification previews are saved on this phone. The app never deletes SMS/RCS. VPN filtering is not connected.")
}

@Composable
fun HistoryScreen(records: List<MessageRecord>, review: (String) -> Unit) {
    var filterName by rememberSaveable { mutableStateOf(HistoryFilter.All.name) }
    val filter = HistoryFilter.valueOf(filterName)
    val flagged = records.count { !it.corrected }
    val demo = records.firstOrNull()?.isDemo == true
    Heading("Your activity", "Protection history", "A local record of warnings and your corrections. Original messages remain in the messaging app.")
    HornetsCard(records.hornetsDefeated(), if (demo) "DEMO · NOV 1–7" else "SAVED HISTORY · ON THIS PHONE", "${records.size} reviewed · $flagged flagged · ${records.size - flagged} corrected")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        HistoryFilter.entries.forEach { value ->
            val count = records.filtered(value).size
            FilterChip(selected = filter == value, onClick = { filterName = value.name },
                label = { Text("${value.name} $count", style = MaterialTheme.typography.bodySmall) },
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PinkTint, selectedLabelColor = Pink))
        }
    }
    records.filtered(filter).forEach { message ->
        Surface(onClick = { review(message.id) }, shape = MaterialTheme.shapes.large, color = androidx.compose.ui.graphics.Color.White) {
            Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Badge(if (message.corrected) "Corrected" else "Flagged", if (message.corrected) Green else Amber, if (message.corrected) GreenTint else AmberTint)
                    Text(message.time, style = MaterialTheme.typography.bodySmall, color = Muted)
                }
                Text(message.title, style = MaterialTheme.typography.titleMedium)
                Body(message.domain ?: "No link in message")
                Body("${message.category} · ${if (message.corrected) "Reviewed by you" else message.protectionAction}")
                if (message.corrected) Text("You marked this as not a scam. Tango flag removed; SMS unchanged.", color = Green, style = MaterialTheme.typography.bodyMedium)
                else if (message.isDemo && message.domainBlocked) Surface(color = GreenTint, shape = MaterialTheme.shapes.medium) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text("10:43 AM · Domain request blocked (demo)", color = Green, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                        Text("Same attempt as the 10:42 AM warning. Counted once, not twice.", color = Green, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
    if (records.filtered(filter).isEmpty()) Body("No ${filter.name.lowercase()} records.")
    Body(if (demo) "These are fictional demo records." else "These are real notification-preview records saved locally. No SMS inbox access is used.")
}

@Composable
fun SettingsScreen(alerts: Boolean, access: Boolean, demo: Boolean, openAccess: () -> Unit,
                   requestAlerts: () -> Unit, vpn: () -> Unit, reset: () -> Unit, showReal: (() -> Unit)? = null, clearHistory: (() -> Unit)? = null) {
    Heading("Your choices", "Privacy & protection")
    Panel {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Notification access", style = MaterialTheme.typography.titleMedium)
            Badge(if (access) "On" else "Off", if (access) Green else Muted, if (access) GreenTint else Background)
        }
        Body("Android access may expose sender names, previews and other personal notification details. Tango inspects messaging previews locally and retains up to 200 flagged records on this device. Clear saved real history below deletes them.")
        TextAction("Manage notification access ↗", openAccess)
        HorizontalDivider(color = Line)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Tango warning alerts", style = MaterialTheme.typography.titleMedium)
            Badge(if (alerts) "Allowed" else "Off", if (alerts) Green else Muted, if (alerts) GreenTint else Background)
        }
        TextAction("Manage Android alerts ↗", requestAlerts)
    }
    Panel {
        Text("Hornet’s Nest sharing", style = MaterialTheme.typography.titleMedium)
        Badge("Ask each time")
        Body("Review redacted threat indicators before sharing via Spacetime. Raw message text isn’t uploaded by default. This frontend does not upload anything.")
    }
    Panel {
        Text("Cloud analysis", style = MaterialTheme.typography.titleMedium)
        Badge("Off · not connected")
        Body("Cloud classification would send message content to a server. It requires separate consent and redaction; confirming a community share does not enable it.")
    }
    Panel {
        Text("Malicious-link protection", style = MaterialTheme.typography.titleMedium)
        Badge("Disconnected")
        Body("No local VPN is running. Simulated Home statuses are for the demo only.")
        TextAction("Local VPN setup →", vpn)
    }
    Body(if (demo) "Demo preview is on. Real monitoring continues independently. Permission badges above show actual Android states." else "Real message mode is selected. Local checks run when Android notification access is connected.")
    if (showReal != null) SecondaryButton("Show real messages", onClick = showReal)
    if (clearHistory != null) SecondaryButton("Clear saved real history", onClick = clearHistory)
    SecondaryButton("Reset demo & return to setup", AppIcons.RestartAlt, reset)
}
