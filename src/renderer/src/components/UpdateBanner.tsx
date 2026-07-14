import { useEffect, useState } from 'react'
import {
  isElectron,
  onUpdateStatus,
  installUpdate,
  checkForUpdate,
  getAppVersion,
  type UpdateStatus
} from '../data/platform'

// Desktop-only auto-update UI. Listens for status pushed from the main process
// (electron-updater) and offers a one-click restart-to-update when a new version
// has finished downloading. Renders nothing on the web build.
export default function UpdateBanner(): JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'none' })
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!isElectron()) return
    void getAppVersion().then(setVersion)
    const off = onUpdateStatus(setStatus)
    return off
  }, [])

  if (!isElectron()) return null

  if (status.state === 'downloaded') {
    return (
      <div className="update-banner ready">
        <span>
          Update {status.version ? `v${status.version} ` : ''}ready.
        </span>
        <button className="update-btn" onClick={installUpdate}>
          Restart &amp; install
        </button>
      </div>
    )
  }

  if (status.state === 'downloading') {
    return (
      <div className="update-banner">
        <span>Downloading update… {status.percent ?? 0}%</span>
      </div>
    )
  }

  // Idle: show current version + a manual check (useful, and confirms the wiring).
  return (
    <div className="update-foot">
      {version && <span className="subtle">v{version}</span>}
      <button
        className="update-check"
        onClick={checkForUpdate}
        title="Check for updates"
        disabled={status.state === 'checking'}
      >
        {status.state === 'checking' ? 'Checking…' : 'Check for updates'}
      </button>
      {status.state === 'error' && <span className="subtle upd-err">update error</span>}
    </div>
  )
}
