import type { CapacitorConfig } from '@capacitor/cli'

// Native Android shell around the same web build that powers the PWA (dist-web).
// The app ships that bundle for OFFLINE use and pulls new versions over-the-air
// via Capgo (@capgo/capacitor-updater) — no Play Store resubmission per update.
const config: CapacitorConfig = {
  appId: 'com.kamran.vgchelper',
  appName: 'VGC Helper',
  webDir: 'dist-web',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true, // check + apply OTA bundles from Capgo on launch/resume
      resetWhenUpdate: true // clear stale bundles when the native binary updates
    },
    // Route fetch() through native HTTP so the battle-data CSVs (no CORS headers)
    // load on device — gives the app full per-forme usage data.
    CapacitorHttp: {
      enabled: true
    }
  }
}

export default config
