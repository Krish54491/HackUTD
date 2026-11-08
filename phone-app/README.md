# Tango Android frontend

Native Kotlin / Jetpack Compose app with on-device messaging-notification warnings and an implementation of [Phone-App.md](Phone-App.md). Open **this `phone-app` directory** as a project in Android Studio, rather than creating a new project over it.

## Run in Android Studio

1. Select **File → Open**, choose `phone-app`, and let Gradle sync.
2. In **Settings → Build, Execution, Deployment → Build Tools → Gradle**, select **JDK 21** (JDK 17 also works). Gradle 8.14.3 is not compatible with JDK 25 bundled in some newer Android Studio installations.
3. Install Android SDK Platform 36 if Android Studio prompts for it.
4. Select an emulator or a connected Android phone running Android 8.0 / API 26 or newer, then run the **app** configuration.
5. On the setup screen, scroll down and select **Preview demo protection** to explore all screens. **Set up later** also opens Home, with actual protection shown as inactive.

For IDE previews without an emulator, open `ui/Previews.kt` and select Android Studio’s **Split** or **Design** view.

The Gradle wrapper and build configuration are included. Android Studio manages the ignored `local.properties` file containing your SDK path.

## Terminal build

From this directory, with JDK 17 or 21 and the Android SDK configured:

```sh
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

On this Mac, you can explicitly select the installed JDK 21:

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home ./gradlew :app:assembleDebug :app:testDebugUnitTest
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Implemented

- Protection setup and permission-readiness count.
- Home with actual listener/alert readiness, saved real flagged messages, and unique warned-attempt totals. Demo records remain available as an explicit preview.
- Message review with defanged, non-clickable links, warning tags, and correction confirmation.
- Per-message local heuristic explanations and T-Mobile call-protection guidance. Real records label unperformed reputation/domain-age checks honestly; demo results remain explicitly simulated.
- History with All / Flagged / Corrected filters. Corrections update counts and remove the threat-sharing action.
- Optional sharing preview containing only domain, category, and reason tags. Confirmation is explicitly a local demo, with no upload.
- Privacy settings, real Android permission state refreshed on resume, and Android settings links.
- A real, explicitly labeled demo warning notification with a Review message action back into the app. Allow alerts first, then use **Show demo warning notification** on Home.
- Home / History / Settings bottom navigation, detail-screen back navigation, scrollable screens, and the T-Mobile light-mode character asset.

The ViewModel preserves preview mode and demo corrections across rotation. Real flagged notification previews and corrections are saved in app-private storage, up to the latest 200 records, and survive app restarts. Settings → Clear saved real history deletes those app records and warning alerts, leaving the messaging inbox unchanged. Demo reset does not delete real history.

## Text interception / warnings

`ProtectionAccessService` now implements `onNotificationPosted`. It handles the default SMS app and standard Google/Samsung/AOSP messaging packages, ignores its own notifications and summary/ongoing alerts, and inspects only the latest available incoming preview. It does not request SMS inbox permissions or change the default messaging app.

`LocalScamDetector` performs offline checks for urgent deadlines, payment requests, credentials, unexpected prizes, gift-card payments, shortened links, and common digit-based lookalike domains. A warning requires multiple indicators; these are suspicions rather than proof. No message content is sent to a server.

Flagged previews are saved locally before warning delivery. If warning permission and the warning channel are enabled, the app posts a generic warning with a unique Review message action. It requests cancellation of the original alert only after posting the replacement and confirming the original notification has not been replaced by a newer message. An Android removal callback confirms when the original alert was actually hidden. The original SMS/RCS remains in the messaging inbox.

If warning alerts are disabled or posting fails, the original alert is retained. The record appears as flagged locally, without being counted as a warned hornet. Reposted notifications are deduplicated; corrected records are not re-warned. Real warning taps switch out of demo mode and open the matching record/animation. Merely opening a record does not add another hornet.

The app starts in real-message mode. Home and Settings offer Show real messages when demo mode is selected. Enable notification access and warning alerts, then return to Home and check for Active monitoring. Local records are capped at 200, and the displayed count refers to saved warned attempts, not an unlimited lifetime total.

## Remaining boundaries

This is notification-preview inspection, not pre-delivery SMS interception. The original alert can appear or make a sound before Android delivers its callback to Tango. The app cannot inspect hidden/unavailable previews and does not bypass Android redaction. A warning does not prove that a message is fraudulent.

DNS/VPN filtering, cloud classification, URL reputation services, and Spacetime threat sharing are still unconnected. No internet permission is declared. Sharing screens remain previews and do not upload message content. The warning animation runs inside the app when opened, not over other applications.

Manual verification steps are in [TESTING-MESSAGE-WARNINGS.md](TESTING-MESSAGE-WARNINGS.md). No build, automated test, emulator run, or real-message test was performed for this change.

## Structure

- `app/src/main/java/com/tango/app/ui/`: Compose theme, reusable components, screens, and navigation.
- `app/src/main/java/com/tango/app/data/`: fictional records, correction/filter logic, allowlisted threat payload, and saved-state ViewModel.
- `MainActivity.kt`: lifecycle-aware Android permission/channel checks and notification deep links.
- `ProtectionAccessService.kt`: messaging-notification extraction, deduplication, and original-alert dismissal.
- `WarningNotifications.kt`: generic replacement alerts with per-record deep links.
- `data/LocalScamDetector.kt`: local-only message indicators.
- `data/MessageRepository.kt`: bounded app-private real records and corrections.
- `app/src/test/`: unique-attempt counts, corrections, filters, sharing payload, and defanged-link tests.


## Native warning animation

The Android app reuses the extension's character limbs, light-mode suspicious/angry faces, hornet, and roll/pop/slash audio. The sequence runs inside the app, not as an overlay over other applications.

- Medium risk: roll in, pop out limbs, then show the warning clues and protection tip.
- High risk: hornet emergence/flight, roll in from the opposite side, limb pop, sword slashes splitting the hornet, then warning clues and a protection tip.
- Low/none and corrected messages: open the review directly without the warning animation.
- Opening a flagged message from Home, History, or the demo notification triggers the appropriate sequence. The account sample is medium risk; delivery and prize samples are high risk.
- Home includes explicit medium/high animation previews, independent of your corrections. Message review includes Replay warning animation for active medium/high records.
- Skip animation advances to the explanation, Sound on/off controls effects, and Android's animation duration scale is respected. Disabling animations jumps directly to the explanation.
- Playback pauses in the background. Audio stops on pause/exit, and rotation preserves animation progress. Previews do not change hornet counts, messages, or permissions.

### Try it manually

1. Run the app from Android Studio and choose Preview demo protection (or Set up later).
2. Scroll Home to Animation previews. Try Preview medium-risk animation and Preview high-risk animation.
3. For high risk, watch the hornet emerge and fly, the character roll in and pop out limbs, and the sword cut the hornet into five pieces. Then select Next to see the protection tip.
4. Use the top back arrow to return Home. Open Unexpected delivery fee to test the high-risk message entry, or Account verification request for medium risk.
5. Use Skip animation, mute/unmute effects, and background/return to the app. In Android Developer options, set Animator duration scale to Animation off and confirm the explanation appears directly.
6. Mark a message as not a scam, then reopen it from History: the corrected record should open without an attack sequence. Home's explicit demo previews still work.

The same native animation is available for real flagged previews and explicit fictional demos. The real warning pipeline uses local checks; backend message classification is not connected.
