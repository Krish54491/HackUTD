# Manually test text interception / warnings

Implementation only: no builds, automated tests, emulator sessions, or real-message tests were run for this change.

## 1. Install and enable

1. Open `phone-app` in Android Studio, select JDK 21, and run the app on an Android phone (or an SMS-capable Android emulator).
2. In setup, allow **Show Tango alerts** and use **Open notification access** to enable Tango. Return to the app afterward.
3. In Android's notification settings, ensure the **Suspicious message warnings** channel is enabled, with alerts allowed. Do Not Disturb or channel settings may prevent heads-up presentation even when a notification is delivered.
4. Choose **Set up later** to reach Home if needed. If a demo is showing, choose **Show real messages** on Home or in Settings. Check that notification monitoring says **Active**.
5. Ensure your messaging app is allowed to post notifications with message previews. Put that app in the background; many messaging apps don't post a notification for the conversation you're currently viewing.

If Android blocks notification-access setup for a sideloaded app, open the installed app's system settings and use Android's Allow restricted settings option when offered for your own build. Then grant notification access normally.

## 2. Safe-message control

Send a new SMS from another phone:

> Lunch at noon tomorrow? See you there.

Expected: normal messaging notification, no Tango warning, no new flagged-history entry. Safe message previews are not retained by this implementation.

## 3. High-risk warning

Send this harmless test text as a NEW SMS (the `.example` destination is a reserved example domain; you do not need to open it):

> URGENT: Your parcel is on hold. Pay a $1.99 redelivery fee within 2 hours: https://parce1-release.example/pay

Expected:

- Tango posts **Suspected scam detected**, with **Review message**.
- The matching original alert is requested for dismissal after replacement delivery; confirm it disappears on your device.
- The original SMS still exists in the messaging app.
- The real record appears in Home and History. The saved warned-attempt total increases once.
- Tap the Tango warning: it opens this actual record through the high-risk animation. Sender, preview, local clues and defanged URL should match the SMS.
- The notification itself does not expose the sender or private message text.

## 4. Medium-risk warning

Send a separate SMS:

> Your account is suspended. Verify your password at https://account-review.example

Expected: local urgency + credential-request clues, a medium-risk record, and the roll-in animation when opening it. No domain-reputation check or cloud-classifier result should be claimed.

## 5. Deduplication and corrections

- Reopen the same record repeatedly: the count should not increase.
- If the messaging app updates/reposts the same underlying notification, it should not produce another record for the same sender/text/message timestamp.
- Mark the record **not a scam**. Its Tango warning should disappear, the record should move to Corrected, and its hornet should no longer be counted. The original SMS remains unchanged.
- Close the app from Recents and reopen it. The real record and correction should remain.
- A genuinely new message with a different message timestamp can be a distinct attempt even if its wording is identical.

## 6. Missing-warning-permission behavior

Disable Tango's warning notifications or the **Suspicious message warnings** channel, keeping notification access enabled. Send a NEW suspicious SMS with slightly different wording.

Expected: the original messaging alert remains; Home shows that warning alerts are unavailable. The locally flagged record is retained but does not count as a successfully warned attempt. Re-enable warning alerts for subsequent checks.

Disabling notification access instead should stop processing new previews, with Home showing access is needed or the listener is waiting.

## 7. RCS and privacy

Repeat a new suspicious message using an RCS-capable sender and the device's messaging app. Behavior depends on whether that app actually posts readable previews. Hidden, redacted or unavailable text cannot be analyzed. Only supported messaging packages/default SMS app are processed; unrelated app notifications and Tango's own warnings are ignored.

In Settings, choose **Clear saved real history** and confirm. App records and Tango warning alerts should disappear, while messages in the messaging app remain. Demo reset is separate and must not delete real history.

## What this does not test or implement

This feature never deletes SMS/RCS, blocks links, uploads message text, performs network reputation checks, or opens an overlay over other apps. Android can display/sound the original notification before a listener callback arrives; this is a replacement-warning flow, not a guaranteed pre-alert block. Heuristics can miss scams or flag legitimate messages.

Android controls notification access and may redact sensitive content. See [NotificationListenerService](https://developer.android.com/reference/android/service/notification/NotificationListenerService) and [Android's sensitive-notification requirements](https://source.android.com/docs/compatibility/15/android-15-cdd).

For an emulator SMS, you can optionally send the high-risk text from a terminal yourself:

```sh
adb emu sms send 15551234567 'URGENT: Your parcel is on hold. Pay a $1.99 redelivery fee within 2 hours: https://parce1-release.example/pay'
```

Use a physical RCS-capable phone for the RCS check. The existing **Show demo warning notification** button tests only the demo/deep-link path, not incoming-message detection.
