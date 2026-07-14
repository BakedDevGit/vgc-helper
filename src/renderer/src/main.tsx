import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { isElectron } from './data/platform'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the PWA service worker on the web build only (Electron has window.api
// and doesn't need offline caching). 'sw.js' is resolved relative to the page so
// it works whether the app is hosted at a domain root or a subpath.
if (!isElectron() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* SW unsupported / blocked — app still works online */
    })
  })
}
