import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { isElectron, isNativeApp } from './data/platform'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the PWA service worker on the web build only (Electron has window.api
// and doesn't need offline caching). 'sw.js' is resolved relative to the page so
// it works whether the app is hosted at a domain root or a subpath.
if (!isElectron() && !isNativeApp() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* SW unsupported / blocked — app still works online */
    })
  })
}

// On the native Android app (Capacitor), tell Capgo the bundle loaded OK — without
// this the OTA plugin rolls back to the previous version. No-op on web/desktop.
if (Capacitor.isNativePlatform()) {
  import('@capgo/capacitor-updater')
    .then(({ CapacitorUpdater }) => CapacitorUpdater.notifyAppReady())
    .catch(() => {
      /* updater unavailable */
    })
}
