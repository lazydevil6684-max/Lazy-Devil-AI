---
name: APK build setup
description: How the Lazy Devil Terminal APK build is configured and what files do what
---

EAS build profile (preview) produces a sideloadable APK. newArchEnabled must be false for Magisk/root compat.

**Key files:**
- `artifacts/lazy-devil/eas.json` — preview profile: buildType apk, gradleCommand assembleRelease
- `artifacts/lazy-devil/app.json` — 35 Android permissions, minSdkVersion 26, newArchEnabled false
- `artifacts/lazy-devil/plugins/withRootExec.js` — config plugin that injects RootExecModule.kt (su -c execution) and RootExecPackage.kt into the Android project during prebuild
- `artifacts/lazy-devil/plugins/withAndroidPermissions.js` — adds all permissions + cleartext traffic to AndroidManifest
- `artifacts/lazy-devil/modules/RootExec.ts` — JS interface for NativeModules.RootExec (Android-only)

**Build command (from project root):**
```
cd artifacts/lazy-devil && eas build --platform android --profile preview
```
Requires: `eas login` first (free expo.dev account)

**Why config plugin pattern (not local workspace package):**
EAS handles config plugins reliably in pnpm monorepos. Local workspace native modules require extra gradle config that often breaks. Config plugins inject Kotlin at prebuild time and are auto-discovered by Expo.

**newArchEnabled: false** — Required because Magisk su execution uses old-arch NativeModules pattern. New arch uses Turbo Modules which breaks the su bridge.
