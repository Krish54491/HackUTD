package com.tango.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import com.tango.app.data.*
import com.tango.app.MonitoringStatus
import kotlinx.coroutines.launch

@Composable
fun TangoApp(
    alertsAllowed: Boolean,
    notificationAccess: Boolean,
    openReview: String?,
    consumeReview: () -> Unit,
    requestAlerts: () -> Unit,
    openNotificationAccess: () -> Unit,
    showDemoNotification: () -> Unit,
    model: TangoViewModel = viewModel(),
) {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route ?: "setup"
    val records by model.records.collectAsStateWithLifecycle()
    val demo by model.demo.collectAsStateWithLifecycle()
    val loadingRecords by model.loading.collectAsStateWithLifecycle()
    val storageError by model.storageError.collectAsStateWithLifecycle()
    val operationError by model.operationError.collectAsStateWithLifecycle()
    val monitoring by MonitoringStatus.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var vpnInfo by rememberSaveable { mutableStateOf(false) }
    var confirmClear by rememberSaveable { mutableStateOf(false) }
    val roots = listOf("home", "history", "settings")
    val detail = route !in roots && route != "setup"
    fun root(destination: String) {
        nav.navigate(destination) { popUpTo(nav.graph.id); launchSingleTop = true }
    }
    fun notify(text: String) { scope.launch { snackbar.showSnackbar(text) } }
    fun openMessage(id: String) {
        val message = model.findRecord(id)
        if (message != null && !message.corrected && message.risk in setOf(MessageRisk.MEDIUM, MessageRisk.HIGH)) {
            nav.navigate("warning/$id/${message.risk.name}")
        } else nav.navigate("review/$id")
    }

    LaunchedEffect(openReview, loadingRecords, records) {
        openReview?.let { id ->
            if (id.startsWith("live-") && loadingRecords) return@LaunchedEffect
            if (model.findRecord(id) != null) {
                if (id.startsWith("live-")) model.showLiveRecords() else model.enableDemo()
                root("home")
                openMessage(id)
            } else notify("This message record is no longer available.")
            consumeReview()
        }
    }
    LaunchedEffect(operationError, storageError) {
        (operationError ?: storageError)?.let { notify(it) }
    }
    Scaffold(
        containerColor = Background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            Column(Modifier.background(MaterialTheme.colorScheme.surface).statusBarsPadding()) {
                Row(Modifier.fillMaxWidth().height(68.dp).padding(horizontal = 22.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (detail) IconButton(onClick = { nav.popBackStack() }) {
                        Icon(AppIcons.ArrowBack, "Go back")
                    } else CharacterAvatar()
                    Text("tango.", fontSize = 27.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-1.3).sp)
                }
                HorizontalDivider(color = Line.copy(alpha = .3f))
            }
        },
        bottomBar = {
            if (route in roots) NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                listOf(Triple("home", "Home", AppIcons.Shield), Triple("history", "History", AppIcons.History), Triple("settings", "Settings", AppIcons.Settings)).forEach { (path, label, icon) ->
                    NavigationBarItem(selected = route == path, onClick = { root(path) },
                        icon = { Icon(icon, label) }, label = { Text(label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = Pink, selectedTextColor = Pink,
                            indicatorColor = PinkTint, unselectedIconColor = Muted, unselectedTextColor = Muted))
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            NavHost(navController = nav, startDestination = "setup", modifier = Modifier.widthIn(max = 600.dp).fillMaxSize()) {
                composable("setup") {
                    Screen {
                        SetupScreen(alertsAllowed, notificationAccess, requestAlerts, openNotificationAccess,
                            vpn = { vpnInfo = true }, later = { root("home") },
                            preview = { model.enableDemo(); root("home") })
                    }
                }
                composable("home") {
                    Screen {
                        HomeScreen(records, demo, alertsAllowed, notificationAccess,
                            review = { openMessage(it) }, history = { root("history") },
                            setup = { nav.navigate("setup") },
                            demoNotification = {
                                if (alertsAllowed) { showDemoNotification(); notify("Demo warning sent. No real message was read or hidden.") }
                                else { requestAlerts(); notify("Allow alerts, then tap the demo notification button again.") }
                            },
                            previewWarning = { risk -> nav.navigate("animation-preview/${risk.name}") },
                            monitoringConnected = monitoring.connected,
                            monitoringError = monitoring.error ?: storageError,
                            showReal = { model.showLiveRecords() })
                    }
                }
                composable("history") {
                    Screen { HistoryScreen(records) { openMessage(it) } }
                }
                composable("settings") {
                    Screen {
                        SettingsScreen(alertsAllowed, notificationAccess, demo, openNotificationAccess, requestAlerts,
                            vpn = { vpnInfo = true }, reset = { model.resetDemo(); root("setup") },
                            showReal = { model.showLiveRecords(); root("home") },
                            clearHistory = { confirmClear = true })
                    }
                }
                composable("animation-preview/{risk}") { backEntry ->
                    val risk = if (backEntry.arguments?.getString("risk") == MessageRisk.HIGH.name) MessageRisk.HIGH else MessageRisk.MEDIUM
                    WarningAnimationScreen(DemoRecords.messages.first(), risk) { root("home") }
                }
                composable("warning/{id}/{risk}") { backEntry ->
                    val id = backEntry.arguments?.getString("id") ?: "delivery"
                    val message = records.firstOrNull { it.id == id } ?: model.findRecord(id)
                    val risk = if (backEntry.arguments?.getString("risk") == MessageRisk.HIGH.name) MessageRisk.HIGH else MessageRisk.MEDIUM
                    val review = {
                        nav.popBackStack()
                        nav.navigate("review/$id") { launchSingleTop = true }
                    }
                    if (message != null && !message.corrected) {
                        WarningAnimationScreen(message, risk, review)
                    } else Screen {
                        Body("There is no active warning for this record.")
                        PrimaryButton("Review message", onClick = review)
                    }
                }
                composable("review/{id}") { backEntry ->
                    val id = backEntry.arguments?.getString("id")
                    val message = records.firstOrNull { it.id == id } ?: id?.let(model::findRecord)
                    Screen {
                        if (message != null) ReviewScreen(message,
                            explanation = { nav.navigate("why/${message.id}") },
                            share = { nav.navigate("share/${message.id}") },
                            correct = { model.correctMessage(message.id) },
                            animation = if (!message.corrected && message.risk in setOf(MessageRisk.MEDIUM, MessageRisk.HIGH)) {
                                { nav.navigate("warning/${message.id}/${message.risk.name}") }
                            } else null)
                        else Body("Message record not found.")
                    }
                }
                composable("why/{id}") { backEntry ->
                    val id = backEntry.arguments?.getString("id")
                    val message = records.firstOrNull { it.id == id } ?: id?.let(model::findRecord)
                    Screen { if (message != null) ExplanationScreen(message) { nav.popBackStack() } else Body("Message record not found.") }
                }
                composable("share/{id}") { backEntry ->
                    val id = backEntry.arguments?.getString("id")
                    val message = records.firstOrNull { it.id == id } ?: id?.let(model::findRecord)
                    Screen {
                        if (message != null) ShareScreen(message,
                            cancel = { nav.popBackStack() },
                            confirm = { notify("Demo confirmation only. Nothing was uploaded; Spacetime sharing is not connected.") })
                        else Body("Message record not found.")
                    }
                }
            }
        }
    }
    if (confirmClear) AlertDialog(onDismissRequest = { confirmClear = false },
        title = { Text("Clear saved message history?") },
        text = { Text("This deletes this app’s locally saved real message previews and warning records, and dismisses its warning alerts. Messages in your messaging app are unchanged. Demo records are separate.") },
        confirmButton = { TextButton(onClick = { model.clearLiveHistory(); confirmClear = false }) { Text("Clear history") } },
        dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("Cancel") } })
    if (vpnInfo) AlertDialog(onDismissRequest = { vpnInfo = false },
        icon = { Icon(AppIcons.Shield, null, tint = Pink) },
        title = { Text("Local VPN protection") },
        text = { Text("The VPN setup shown in the mockups is not connected in this frontend. No VPN is running and no traffic is filtered. The optional VpnService implementation can be connected here later.") },
        confirmButton = { TextButton(onClick = { vpnInfo = false }) { Text("Got it") } })
}

@Composable
private fun Screen(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp, vertical = 26.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp), content = content)
}
