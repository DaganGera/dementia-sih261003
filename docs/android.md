# Building the Android app

Status: the Capacitor 8 project exists in `apps/app/android`. It has not been built or installed on a phone, because Android Studio, the Android SDK and JDK 21 are not installed on the build machine (java 1.8 only, no `adb`, no `ANDROID_HOME`). This is human task H-05.

## One-time setup (PowerShell)

1. Install Android Studio 2025.2.1 or newer, with SDK Platform 36 and platform-tools. Capacitor 8 needs Node 22 or newer (present).
2. Set the environment for your user:

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$path;$env:LOCALAPPDATA\Android\Sdk\platform-tools", 'User')
```

3. Open a new shell and check: `adb version`, `& "$env:JAVA_HOME\bin\java.exe" -version` (must be 21 or newer).

## Build and install a debug APK

```powershell
pnpm --filter app build
pnpm --filter app exec cap sync android
Push-Location apps\app\android; .\gradlew.bat assembleDebug; Pop-Location
adb install -r apps\app\android\app\build\outputs\apk\debug\app-debug.apk
```

## What to test on the phone (spike S-ALARM, S-DB)

| Check | How | Record in |
|---|---|---|
| Exact alarms | Add a reminder 2 minutes ahead in the family view. Lock the phone, turn on airplane mode. Note the delay. Repeat with exact alarms denied in Settings, then after a reboot. | `docs/spikes/S-ALARM.md` |
| Storage | Play a session, force-stop the app, reopen: records persist. | `docs/spikes/S-DB.md` |
| Camera | Pair two devices by scanning. | `docs/e2e/airplane.md` |
| Microphone | Record a family message; it plays back on the same device. | same |
| 3 GB phone | Cold start under 3 s, game rounds without dropped frames. | same |

## Permissions in the manifest

`CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`. On Android 14 and later, `SCHEDULE_EXACT_ALARM` is denied by default for new installs, so the app shows a notice when reminders may be late (message E04 in the plan). `USE_EXACT_ALARM` is not used because it is meant for alarm and calendar apps.
