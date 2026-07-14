import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

// Auto-update via GitHub Releases (config in package.json build.publish). Sends
// status to the renderer so the UI can show an "update ready" banner. Only runs
// in a packaged app — in dev there's no update feed.
function setupAutoUpdate(win: BrowserWindow): void {
  const send = (status: Record<string, unknown>): void => {
    if (!win.isDestroyed()) win.webContents.send('update:status', status)
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => send({ state: 'error', message: String(err?.message ?? err) }))

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {
      /* offline / no release feed yet */
    })
  }
}

// Generic JSON persistence in the app's userData folder.
function storePath(file: string): string {
  return join(app.getPath('userData'), file)
}

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(storePath(file), 'utf-8')) as T
  } catch {
    return fallback
  }
}

async function saveJson(file: string, data: unknown): Promise<true> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(storePath(file), JSON.stringify(data, null, 2), 'utf-8')
  return true
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'VGC Helper',
    icon: join(__dirname, '../../resources/icon.png'),
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setupAutoUpdate(mainWindow)
}

// Update controls + version for the renderer UI.
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('update:check', () => autoUpdater.checkForUpdates())
ipcMain.handle('update:install', () => autoUpdater.quitAndInstall())

// Whole app state: { team: PokeSet[], benchmarks: PokeSet[], meta: MetaMap }
ipcMain.handle('state:load', () =>
  loadJson('app-state.json', {
    team: [],
    benchmarks: [],
    meta: {},
    formats: [],
    activeFormatId: '',
    savedTeams: [],
    itemFixes: {}
  })
)
ipcMain.handle('state:save', (_evt, data: unknown) => saveJson('app-state.json', data))

// Text/JSON file import/export via native dialogs (PokePaste teams, legal lists, meta).
ipcMain.handle(
  'file:saveText',
  async (_evt, args: { defaultName: string; content: string; extensions?: string[] }) => {
    const exts = args.extensions ?? ['txt']
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: args.defaultName,
      filters: [{ name: exts.join('/').toUpperCase(), extensions: exts }]
    })
    if (canceled || !filePath) return false
    await writeFile(filePath, args.content, 'utf-8')
    return true
  }
)

// Fetch from an external API (runs in main → no CORS/CSP limits).
type FetchFn = (u: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>
ipcMain.handle('api:fetch', async (_evt, url: string) => {
  const res = await (globalThis as { fetch: FetchFn }).fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})
ipcMain.handle('api:fetchText', async (_evt, url: string) => {
  const res = await (globalThis as { fetch: FetchFn }).fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
})

ipcMain.handle('file:openText', async (_evt, args?: { extensions?: string[] }) => {
  const exts = args?.extensions ?? ['txt', 'text', 'json']
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: exts.join('/').toUpperCase(), extensions: exts }]
  })
  if (canceled || !filePaths[0]) return null
  return readFile(filePaths[0], 'utf-8')
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
