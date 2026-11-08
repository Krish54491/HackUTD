package com.tango.app

import android.app.Notification
import android.os.Build
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.tango.app.data.LocalScamDetector
import com.tango.app.data.MessageRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.ConcurrentHashMap

data class MonitoringState(val connected: Boolean = false, val error: String? = null)
object MonitoringStatus {
    private val _state = MutableStateFlow(MonitoringState())
    val state = _state.asStateFlow()
    fun connected(value: Boolean) { _state.update { it.copy(connected = value, error = if (value) null else it.error) } }
    fun error(value: String?) { _state.update { it.copy(error = value) } }
}

/** Notification access, not inbox access. Never deletes SMS/RCS or uploads their contents. */
class ProtectionAccessService : NotificationListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val work = Mutex()
    private val requestedRemovals = ConcurrentHashMap<String, String>()
    private val repository by lazy { MessageRepository.get(this) }

    override fun onCreate() { super.onCreate(); WarningNotifications.ensureChannel(this) }
    override fun onListenerConnected() { super.onListenerConnected(); MonitoringStatus.connected(true) }
    override fun onListenerDisconnected() { MonitoringStatus.connected(false); super.onListenerDisconnected() }
    override fun onDestroy() { MonitoringStatus.connected(false); scope.cancel(); super.onDestroy() }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val message = runCatching { snapshot(sbn) }.getOrNull() ?: return
        scope.launch {
            work.withLock {
                try {
                    val result = LocalScamDetector.inspect(sbn.packageName, message.sender, message.text, message.messageTime, sbn.postTime) ?: return@withLock
                    // Persistent deduplication includes corrected records, so updates don't re-warn them.
                    repository.insertIfAbsent(result)
                    val saved = repository.records.value.firstOrNull { it.id == result.id } ?: return@withLock
                    if (saved.corrected || saved.warningPosted) return@withLock
                    MonitoringStatus.error(null)
                    if (!WarningNotifications.post(this@ProtectionAccessService, saved)) {
                        MonitoringStatus.error("A message was flagged locally, but warning alerts are disabled. The original alert was retained.")
                        return@withLock
                    }
                    val warned = repository.update(result.id) { if (it.corrected) it else it.copy(warningPosted = true) }
                    if (warned?.corrected != false) {
                        WarningNotifications.cancel(this@ProtectionAccessService, result.id)
                        return@withLock
                    }
                    // Don't cancel a newer legitimate message which reused this conversation's notification key.
                    val current = activeNotifications?.firstOrNull { it.key == sbn.key }
                    val latest = current?.let { runCatching { snapshot(it) }.getOrNull() }
                    if (current != null && latest != null && LocalScamDetector.fingerprint(current.packageName, latest.sender, latest.text, latest.messageTime) == result.id) {
                        requestedRemovals[sbn.key] = result.id
                        repository.update(result.id) { it.copy(dismissalRequested = true) }
                        try { cancelNotification(sbn.key) }
                        catch (_: Exception) {
                            requestedRemovals.remove(sbn.key)
                            repository.update(result.id) { it.copy(dismissalRequested = false) }
                        }
                    }
                } catch (_: Exception) {
                    // Never print notification contents, and never dismiss an alert when processing fails.
                    MonitoringStatus.error("A notification could not be processed or saved. Its original alert was retained unless already dismissed by Android.")
                }
            }
        }
    }
    override fun onNotificationRemoved(sbn: StatusBarNotification, rankingMap: RankingMap, reason: Int) {
        val id = requestedRemovals.remove(sbn.key) ?: return
        if (reason != REASON_LISTENER_CANCEL && reason != REASON_LISTENER_CANCEL_ALL) return
        scope.launch {
            runCatching {
                val updated = repository.update(id) { it.copy(originalAlertHidden = true) }
                if (updated != null && !updated.corrected) WarningNotifications.post(this@ProtectionAccessService, updated)
            }.onFailure { MonitoringStatus.error("The warning history could not be updated.") }
        }
    }
    private data class Preview(val sender: String, val text: String, val messageTime: Long)
    @Suppress("DEPRECATION")
    private fun snapshot(sbn: StatusBarNotification): Preview? {
        if (sbn.packageName == packageName) return null
        val defaultSms = runCatching { Telephony.Sms.getDefaultSmsPackage(this) }.getOrNull()
        val allowed = setOf("com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.android.messaging", defaultSms)
        if (sbn.packageName !in allowed) return null
        val notification = sbn.notification
        if (notification.flags and (Notification.FLAG_GROUP_SUMMARY or Notification.FLAG_ONGOING_EVENT) != 0) return null
        val extras = notification.extras ?: return null
        val bundles = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
        if (!bundles.isNullOrEmpty()) {
            val message = Notification.MessagingStyle.Message.getMessagesFromBundleArray(bundles).lastOrNull() ?: return null
            val sender = if (Build.VERSION.SDK_INT >= 28) message.senderPerson?.name?.toString() else message.sender?.toString()
            // MessagingStyle uses a null sender for the user's own outgoing messages.
            if (sender.isNullOrBlank()) return null
            val selfName = extras.getCharSequence(Notification.EXTRA_SELF_DISPLAY_NAME)?.toString()
            if (!selfName.isNullOrBlank() && sender == selfName) return null
            val text = message.text?.toString()?.take(8000)?.takeIf { it.isNotBlank() } ?: return null
            return Preview(sender.take(200), text, message.timestamp)
        }
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)
            ?: extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.lastOrNull())?.toString()?.take(8000)
            ?.takeIf { it.isNotBlank() } ?: return null
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.take(200).orEmpty()
        return Preview(sender, text, notification.`when`.coerceAtLeast(0L))
    }
}
