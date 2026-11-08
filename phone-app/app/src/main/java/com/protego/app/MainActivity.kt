package com.protego.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.protego.app.ui.ProtegoApp
import com.protego.app.ui.ProtegoTheme

class MainActivity : ComponentActivity() {
    private var openReview by mutableStateOf<String?>(null)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) openReview = intent.getStringExtra("review")
        setContent {
            ProtegoTheme {
                val context = LocalContext.current
                val lifecycle = LocalLifecycleOwner.current
                val manager = context.getSystemService(NotificationManager::class.java)
                var alerts by remember { mutableStateOf(manager.areNotificationsEnabled()) }
                var access by remember { mutableStateOf(manager.isNotificationListenerAccessGranted(ComponentName(context, ProtectionAccessService::class.java))) }
                val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { alerts = manager.areNotificationsEnabled() }
                DisposableEffect(lifecycle) {
                    val observer = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            alerts = manager.areNotificationsEnabled()
                            access = manager.isNotificationListenerAccessGranted(ComponentName(context, ProtectionAccessService::class.java))
                        }
                    }
                    lifecycle.lifecycle.addObserver(observer)
                    onDispose { lifecycle.lifecycle.removeObserver(observer) }
                }
                ProtegoApp(
                    alertsAllowed = alerts, notificationAccess = access,
                    openReview = openReview, consumeReview = { openReview = null },
                    requestAlerts = {
                        if (Build.VERSION.SDK_INT >= 33 && !alerts) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        else startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                    },
                    openNotificationAccess = { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) },
                    showDemoNotification = { postDemoNotification() },
                )
            }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openReview = intent.getStringExtra("review")
    }
    private fun postDemoNotification() {
        val manager = getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return
        manager.createNotificationChannel(NotificationChannel("demo-warnings", "Demo scam warnings", NotificationManager.IMPORTANCE_HIGH))
        val review = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java)
            .putExtra("review", "delivery").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val content = "Simulated delivery-fee request. No real message was read or hidden."
        manager.notify(1, Notification.Builder(this, "demo-warnings")
            .setSmallIcon(com.protego.app.R.drawable.ic_protego)
            .setContentTitle("Demo · suspected scam detected")
            .setContentText(content)
            .setStyle(Notification.BigTextStyle().bigText(content))
            .setContentIntent(review)
            .addAction(Notification.Action.Builder(null, "Review message", review).build())
            .setAutoCancel(true).build())
    }
}
