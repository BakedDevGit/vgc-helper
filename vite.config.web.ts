import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// PWA <head> tags injected only into the web build, so the Electron index.html
// (shared source file) stays free of manifest/icon references it doesn't use.
const pwaHead: Plugin = {
  name: 'inject-pwa-head',
  transformIndexHtml(html) {
    return html.replace(
      '</head>',
      `    <link rel="manifest" href="manifest.webmanifest" />
    <meta name="theme-color" content="#0f1320" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="VGC Helper" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="icon-192.png" />
  </head>`
    )
  }
}

// Proxies the same-origin /cbd prefix to the battle-data API (server-side, so no
// CORS) for `vite dev`/`vite preview`. Mirrors public/_redirects on Netlify.
const cbdProxy = {
  '/cbd': {
    target: 'https://championsbattledata.com',
    changeOrigin: true,
    rewrite: (p: string): string => p.replace(/^\/cbd/, '')
  }
}

// Standalone web/PWA build of the renderer (no Electron). Outputs to dist-web/.
// `base: './'` keeps asset URLs relative so it can be hosted at a domain root
// or a subpath (e.g. GitHub Pages project page) unchanged.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [react(), pwaHead],
  server: { proxy: cbdProxy },
  preview: { proxy: cbdProxy },
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true
  }
})
