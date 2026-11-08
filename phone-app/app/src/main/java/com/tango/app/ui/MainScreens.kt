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
        Body("Not active yet")
    }
    PermissionCard(AppIcons.NotificationsActive, "Show Tango alerts", if (alerts) "Allowed" else "Needed", alerts,
        "Warnings can appear when a message looks suspicious. ${if (alerts) "You’ve allowed this permission." else "Allow Tango to show warning notifications."}",
        if (alerts) "Manage Android alerts ↗" else "Allow warning alerts ↗", requestAlerts)
    PermissionCard(AppIcons.ChatBubbleOutline, "Notification access", if (access) "Allowed" else "Needed", access,
        "Android grants access to notifications, which may include sender names, message previews and personal details. This frontend does not read real messages.",
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
               review: (String) -> Unit, history: () -> Unit, setup: () -> Unit, demoNotification: () -> Unit) {
    Heading("Your protection", if (demo) "On guard. In the\nbackground." else "Your protection,\nat a glance.")
    Badge("Demo messages · simulated findings", Pink, PinkTint)
    Panel {
        StatusRow(AppIcons.NotificationsActive, "Notification monitoring",
            if (demo) "Simulated access & warning alerts" else if (!access || !alerts) "Required permissions missing" else "Permissions ready · scanner not connected",
            if (demo) "Demo" else if (!access || !alerts) "Needed" else "Inactive", demo)
        StatusRow(AppIcons.Shield, "Suspicious-domain filtering",
            if (demo) "Simulated local VPN connection" else "Local VPN not connected",
            if (demo) "Demo" else "Off", demo)
    }
    if (!demo) TextAction("Review protection setup →", setup)
    HornetsCard(records.hornetsDefeated(), detail = "Demo attempts interrupted. Each counts once.")
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
    Body("Fictional messages only. Real message scanning and VPN filtering are not running.")
}

@Composable
fun HistoryScreen(records: List<MessageRecord>, review: (String) -> Unit) {
    var filterName by rememberSaveable { mutableStateOf(HistoryFilter.All.name) }
    val filter = HistoryFilter.valueOf(filterName)
    val flagged = records.count { !it.corrected }
    Heading("Your activity", "Protection history", "A clear record of warnings, link blocks and your corrections.")
    HornetsCard(records.hornetsDefeated(), "DEMO · NOV 1–7", "${records.size} reviewed · $flagged flagged · ${records.size - flagged} corrected")
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
                Body("${message.category} · ${if (message.corrected) "Reviewed by you" else "Warning shown (demo)"}")
                if (message.corrected) Text("You marked this as not a scam. Tango flag removed; SMS unchanged.", color = Green, style = MaterialTheme.typography.bodyMedium)
                else if (message.domainBlocked) Surface(color = GreenTint, shape = MaterialTheme.shapes.medium) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text("10:43 AM · Domain request blocked (demo)", color = Green, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                        Text("Same attempt as the 10:42 AM warning. Counted once, not twice.", color = Green, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
    if (records.filtered(filter).isEmpty()) Body("No ${filter.name.lowercase()} records.")
    Body("These are fictional Tango review records. Original messages stay in your messaging app.")
}

@Composable
fun SettingsScreen(alerts: Boolean, access: Boolean, demo: Boolean, openAccess: () -> Unit,
                   requestAlerts: () -> Unit, vpn: () -> Unit, reset: () -> Unit) {
    Heading("Your choices", "Privacy & protection")
    Panel {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Notification access", style = MaterialTheme.typography.titleMedium)
            Badge(if (access) "On" else "Off", if (access) Green else Muted, if (access) GreenTint else Background)
        }
        Body("Android access may expose sender names, previews and other personal notification details. The frontend does not read or store real notifications.")
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
    Body(if (demo) "Demo preview is on. Permission badges above always show real Android states." else "Demo protection preview is off. History contains fictional sample records.")
    SecondaryButton("Reset demo & return to setup", AppIcons.RestartAlt, reset)
}
