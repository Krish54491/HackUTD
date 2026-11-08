package com.tango.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.tango.app.data.MessageRecord

/** Replacement alerts contain generic warnings, not the sender or private message preview. */
object WarningNotifications {
    const val CHANNEL = "message-warnings"
    fun ensureChannel(context: Context) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Suspicious message warnings", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Warnings based on local checks of SMS/RCS notification previews"
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            }
        )
    }
    fun canPost(context: Context): Boolean {
        val manager = context.getSystemService(NotificationManager::class.java)
        return manager.areNotificationsEnabled() && manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
    }
    fun post(context: Context, record: MessageRecord): Boolean {
        if (record.corrected) return false
        ensureChannel(context)
        if (!canPost(context)) return false
        val intent = Intent(context, MainActivity::class.java).apply {
            data = Uri.parse("tango://review/${record.id}")
            putExtra("review", record.id)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val review = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val text = if (record.originalAlertHidden) "Original alert hidden. The message remains in your messaging inbox."
            else "A message looks suspicious. Review it before responding. The message remains in your messaging inbox."
        val alert = Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_tango).setContentTitle("Suspected scam detected")
            .setContentText(text).setStyle(Notification.BigTextStyle().bigText(text))
            .setCategory(Notification.CATEGORY_STATUS).setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(review).addAction(Notification.Action.Builder(null, "Review message", review).build())
            .setOnlyAlertOnce(true).setAutoCancel(true).setLocalOnly(true).build()
        return runCatching { context.getSystemService(NotificationManager::class.java).notify(record.id, 0, alert); true }.getOrDefault(false)
    }
    fun cancel(context: Context, id: String) { context.getSystemService(NotificationManager::class.java).cancel(id, 0) }
    fun clearLiveAlerts(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.activeNotifications.filter { it.tag?.startsWith("live-") == true }.forEach { manager.cancel(it.tag, it.id) }
    }
}
