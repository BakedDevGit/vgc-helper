# Releasing & updates

Three build targets share one codebase:

| Target  | Build                | Updates                                   |
| ------- | -------------------- | ----------------------------------------- |
| Desktop | `npm run package`    | Auto-update from GitHub Releases          |
| Web/PWA | `npm run build:web`  | Redeploy `dist-web/`; service worker pulls new assets |
| Android | `npm run cap:apk`    | Offline bundle + Capgo over-the-air (OTA) |

---

## Desktop — auto-update via GitHub Releases

One-time setup:

1. In `package.json` → `build.publish`, replace `YOUR_GITHUB_USERNAME` with your GitHub username.
2. Create a GitHub repo named `vgc-helper`, then:
   ```
   git remote add origin https://github.com/<you>/vgc-helper.git
   git push -u origin master
   ```
3. Create a GitHub Personal Access Token (classic) with the `repo` scope.

Each release:

1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.1.1`). The updater compares this.
2. Publish (PowerShell):
   ```
   $env:GH_TOKEN="<your token>"; npm run release
   ```
   This builds the NSIS installer and creates a **published** GitHub Release (tag `v<version>`) with the installer + `latest.yml` attached. No manual publish step. (`releaseType: release` in `build.publish` — using a real release, not a draft, also avoids a race that can split assets across two drafts.)

How it updates: users install `VGC-Helper-Setup-<version>.exe` once. On every launch the app checks the GitHub feed; a new version downloads in the background and the in-app banner offers **Restart & install**. (Windows may show a SmartScreen prompt since the build is unsigned — "More info → Run anyway".)

---

## Android — APK + Capgo OTA

Build the installable APK (needs **Android Studio**; Java 17 already present):

1. `npm run cap:apk` — builds the web bundle, syncs it into `android/`, and opens Android Studio.
2. In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**. For a shareable release build, use **Generate Signed Bundle / APK** and create a keystore (keep it safe — you need the same key for every update).
3. Copy the APK to your phone and install (allow "install from unknown sources").

The APK ships `dist-web` inside it, so the app works **offline**.

Over-the-air updates (no reinstall, no Play Store) via [Capgo](https://capgo.app):

1. Create a free Capgo account, then:
   ```
   npx @capgo/cli login <YOUR_CAPGO_KEY>
   npx @capgo/cli app add com.kamran.vgchelper
   npx @capgo/cli channel add production com.kamran.vgchelper --default
   ```
2. Ship an update after code changes:
   ```
   npm run build:web
   npx @capgo/cli bundle upload com.kamran.vgchelper --channel production
   ```
   Installed apps auto-download the new bundle on next launch (config `autoUpdate: true`). `notifyAppReady()` in `main.tsx` confirms a good load so Capgo won't roll back.

The `appId` (`com.kamran.vgchelper`) must stay identical across the native build and every Capgo upload.

> iOS isn't covered — building/signing it requires a Mac + Xcode + an Apple Developer account ($99/yr).
