package com.protego.app

import android.service.notification.NotificationListenerService

/** Permission integration point only. The frontend never reads or dismisses real messages. */
class ProtectionAccessService : NotificationListenerService()
