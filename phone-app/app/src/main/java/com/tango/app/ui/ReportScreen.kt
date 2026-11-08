package com.tango.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tango.app.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReportScreen(initial: String, nest: HornetNest, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var site by rememberSaveable { mutableStateOf(initial) }
    var category by rememberSaveable { mutableStateOf<ReportCategory?>(null) }
    var note by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reported by rememberSaveable { mutableStateOf<String?>(null) }
    var reports by rememberSaveable { mutableIntStateOf(0) }

    reported?.let { domain ->
        Heading("Hornet’s Nest", "Hornet reported.\nThanks!")
        Panel(GreenTint) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CharacterAvatar(40)
                Text("Thanks for the heads-up", color = Green, style = MaterialTheme.typography.titleMedium)
            }
            Body("Your report is in the Hornet’s Nest, where it helps keep the whole community safe.", Green)
            Badge(domain, Pink, PinkTint)
            Body("${reportsLabel(reports)} reported this site.", Green)
        }
        PrimaryButton("Done", onClick = done)
        SecondaryButton("Report another site", AppIcons.Flag) {
            reported = null; site = ""; category = null; note = ""
        }
        return
    }

    Heading("Report a hornet", "Spot a scam\nTango missed?", "Tell Tango about a scam website so the whole hive can steer clear.")
    Panel {
        OutlinedTextField(site, { site = it; error = null }, Modifier.fillMaxWidth(), enabled = !sending, singleLine = true,
            label = { Text("Website") }, placeholder = { Text("example.com") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next))
        Text("What kind of scam?", style = MaterialTheme.typography.titleMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            ReportCategory.entries.forEach { c ->
                FilterChip(selected = category == c, onClick = { category = c; error = null }, enabled = !sending,
                    label = { Text(c.label, style = MaterialTheme.typography.bodyMedium) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PinkTint, selectedLabelColor = Pink))
            }
        }
        OutlinedTextField(note, { note = it.take(MAX_REPORT_NOTE) }, Modifier.fillMaxWidth(), enabled = !sending, minLines = 2, maxLines = 4,
            label = { Text("What happened? (optional)") }, placeholder = { Text("e.g. It asked for my bank login") },
            supportingText = { Text("${note.length}/$MAX_REPORT_NOTE") })
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(AppIcons.VisibilityOff, null, Modifier.size(18.dp), tint = Muted)
        Body("Only the website, category and your note are sent. Others only see how many times a site was reported.")
    }
    error?.let { Panel(AmberTint) { Text(it, color = Amber, style = MaterialTheme.typography.bodyMedium) } }
    PrimaryButton(if (sending) "Sending report…" else "Report this site", AppIcons.Flag,
        enabled = !sending && category != null && site.isNotBlank()) {
        val chosen = category ?: return@PrimaryButton
        sending = true; error = null
        scope.launch {
            try {
                val flag = nest.report(site, chosen, note)
                reports = flag.reports
                reported = flag.domain
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = e.message ?: "Unable to send your report. Please try again."
            } finally {
                sending = false
            }
        }
    }
}
