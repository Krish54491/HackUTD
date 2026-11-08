# Tango Android frontend

Native Kotlin / Jetpack Compose implementation of [Phone-App.md](Phone-App.md). Open **this `phone-app` directory** as a project in Android Studio, rather than creating a new project over it.

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
- Home with simulated protection status, recent messages, and unique-attempt hornet totals.
- Message review with defanged, non-clickable links, warning tags, and correction confirmation.
- Per-message explanation, explicitly simulated reputation checks, unavailable domain age, and T-Mobile call-protection guidance.
- History with All / Flagged / Corrected filters. Corrections update counts and remove the threat-sharing action.
- Optional sharing preview containing only domain, category, and reason tags. Confirmation is explicitly a local demo, with no upload.
- Privacy settings, real Android permission state refreshed on resume, and Android settings links.
- A real, explicitly labeled demo warning notification with a Review message action back into the app. Allow alerts first, then use **Show demo warning notification** on Home.
- Home / History / Settings bottom navigation, detail-screen back navigation, scrollable screens, and the T-Mobile light-mode character asset.

The ViewModel and saved-state handle preserve demo corrections and preview mode across rotation and normal Android state restoration. Reset demo in Settings restores the fixtures. No personal messages are collected, and no database is required.

## Frontend boundaries

The records are fictional; they do not come from the phone's SMS inbox. Notification access can be granted through Android settings, but the registered service is only a permission integration point and does not read, classify, hide, or dismiss real notifications. VPN setup explains that filtering is not connected. The app never labels either feature as running; preview statuses say **Demo**.

Spacetime sharing, real notification monitoring, DNS/VPN filtering, reputation services, and cloud classification are not implemented in this frontend. No internet permission is declared. T-Mobile's official guide opens in the device's browser when requested. Sharing and cloud-analysis consent remain separate integration points.

## Structure

- `app/src/main/java/com/tango/app/ui/`: Compose theme, reusable components, screens, and navigation.
- `app/src/main/java/com/tango/app/data/`: fictional records, correction/filter logic, allowlisted threat payload, and saved-state ViewModel.
- `MainActivity.kt`: lifecycle-aware Android permission checks and demo notification handling.
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

This is a native frontend animation with fictional sample messages. Real notification scanning and backend message classification remain separate integrations.
