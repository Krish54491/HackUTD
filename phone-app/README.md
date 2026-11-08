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
- Home / History / Settings bottom navigation, detail-screen back navigation, scrollable screens, and gray placeholder art.

The ViewModel and saved-state handle preserve demo corrections and preview mode across rotation and normal Android state restoration. Reset demo in Settings restores the fixtures. No personal messages are collected, and no database is required.

## Frontend boundaries

The records are fictional; they do not come from the phone's SMS inbox. Notification access can be granted through Android settings, but the registered service is only a permission integration point and does not read, classify, hide, or dismiss real notifications. VPN setup explains that filtering is not connected. The app never labels either feature as running; preview statuses say **Demo**.

Spacetime sharing, real notification monitoring, DNS/VPN filtering, reputation services, and cloud classification are not implemented in this frontend. No internet permission is declared. T-Mobile's official guide opens in the device's browser when requested. Sharing and cloud-analysis consent remain separate integration points.

## Structure

- `app/src/main/java/com/tango/app/ui/`: Compose theme, reusable components, screens, and navigation.
- `app/src/main/java/com/tango/app/data/`: fictional records, correction/filter logic, allowlisted threat payload, and saved-state ViewModel.
- `MainActivity.kt`: lifecycle-aware Android permission checks and demo notification handling.
- `app/src/test/`: unique-attempt counts, corrections, filters, sharing payload, and defanged-link tests.
