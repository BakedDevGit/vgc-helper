import { contextBridge, ipcRenderer, clipboard, type IpcRendererEvent } from 'electron'

export interface UpdateStatus {
  state: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

const api = {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (data: unknown) => ipcRenderer.invoke('state:save', data),
  saveTextFile: (defaultName: string, content: string, extensions?: string[]) =>
    ipcRenderer.invoke('file:saveText', { defaultName, content, extensions }),
  openTextFile: (extensions?: string[]): Promise<string | null> =>
    ipcRenderer.invoke('file:openText', { extensions }),
  clipboardWrite: (text: string) => clipboard.writeText(text),
  clipboardRead: (): string => clipboard.readText(),
  apiFetch: (url: string): Promise<unknown> => ipcRenderer.invoke('api:fetch', url),
  apiFetchText: (url: string): Promise<string> => ipcRenderer.invoke('api:fetchText', url),
  // Auto-update
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  checkForUpdate: (): Promise<unknown> => ipcRenderer.invoke('update:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, status: UpdateStatus): void => cb(status)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
