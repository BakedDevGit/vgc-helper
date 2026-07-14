// Platform shim. The renderer runs in two places:
//   - Electron desktop: a `window.api` bridge (preload) provides native file,
//     clipboard, persistence and HTTP (in the main process, dodging CORS).
//   - Web / installed PWA: no `window.api` — we fall back to browser APIs
//     (IndexedDB for state, the Clipboard API, Blob downloads, fetch).
// Every component talks to this module instead of `window.api` directly, so the
// exact same React code ships to both targets.

import { Capacitor } from '@capacitor/core'

type ElectronApi = Window['api']
const electron = (): ElectronApi | undefined =>
  (globalThis as unknown as { api?: ElectronApi }).api

export const isElectron = (): boolean => !!electron()

// True inside the native Android app (Capacitor). There, CapacitorHttp routes
// fetch() through native code, so cross-origin requests bypass CORS (like the
// Electron main process) — letting us read the per-forme CSVs directly.
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

// --- auto-update (Electron desktop only; on web the PWA service worker updates) -
export interface UpdateStatus {
  state: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

export async function getAppVersion(): Promise<string> {
  const api = electron()
  if (api?.appVersion) return api.appVersion()
  return '' // web build carries no app version
}

export function checkForUpdate(): void {
  electron()?.checkForUpdate?.()
}

export function installUpdate(): void {
  electron()?.installUpdate?.()
}

/** Subscribe to update status pushes. Returns an unsubscribe fn (no-op on web). */
export function onUpdateStatus(cb: (status: UpdateStatus) => void): () => void {
  const api = electron()
  if (!api?.onUpdateStatus) return () => {}
  return api.onUpdateStatus(cb)
}

// --- persistent state (web: IndexedDB, robust for multi-MB battle data) -------
const DB_NAME = 'vgc-helper'
const STORE = 'kv'
const STATE_KEY = 'app-state'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (): void => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = (): void => resolve(req.result)
    req.onerror = (): void => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    r.onsuccess = (): void => resolve(r.result as T)
    r.onerror = (): void => reject(r.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
    r.onsuccess = (): void => resolve()
    r.onerror = (): void => reject(r.error)
  })
}

export async function loadState(): Promise<Record<string, unknown>> {
  const api = electron()
  if (api?.loadState) return ((await api.loadState()) as Record<string, unknown>) ?? {}
  try {
    return (await idbGet<Record<string, unknown>>(STATE_KEY)) ?? {}
  } catch {
    return {}
  }
}

export function saveState(data: unknown): void {
  const api = electron()
  if (api?.saveState) {
    api.saveState(data)
    return
  }
  void idbSet(STATE_KEY, data).catch(() => {
    /* private-mode / quota — state just won't persist this session */
  })
}

// --- clipboard ----------------------------------------------------------------
export async function clipboardWrite(text: string): Promise<void> {
  const api = electron()
  if (api?.clipboardWrite) {
    api.clipboardWrite(text)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* permission denied */
  }
}

export async function clipboardRead(): Promise<string> {
  const api = electron()
  if (api?.clipboardRead) return api.clipboardRead()
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

// --- HTTP (battle-data API; CORS-enabled, so direct fetch works on web) --------
export async function apiFetchJson(url: string): Promise<unknown> {
  const api = electron()
  if (api?.apiFetch) return api.apiFetch(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function apiFetchText(url: string): Promise<string> {
  const api = electron()
  if (api?.apiFetchText) return api.apiFetchText(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// --- text files ---------------------------------------------------------------
export async function saveTextFile(
  defaultName: string,
  content: string,
  extensions?: string[]
): Promise<boolean> {
  const api = electron()
  if (api?.saveTextFile) return api.saveTextFile(defaultName, content, extensions)
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}

export async function openTextFile(extensions?: string[]): Promise<string | null> {
  const api = electron()
  if (api?.openTextFile) return api.openTextFile(extensions)
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = (extensions ?? ['txt', 'json']).map((e) => '.' + e).join(',')
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.onchange = (): void => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = (): void => resolve(String(reader.result ?? ''))
      reader.onerror = (): void => resolve(null)
      reader.readAsText(file)
    }
    document.body.appendChild(input)
    input.click()
  })
}
