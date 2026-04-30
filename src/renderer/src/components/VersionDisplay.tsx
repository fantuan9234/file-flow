import { useEffect, useState } from 'react'

interface VersionInfo {
  electron: string
  chrome: string
  node: string
}

export function VersionDisplay() {
  const [versions, setVersions] = useState<VersionInfo | null>(null)

  useEffect(() => {
    if (window.electron?.process?.versions) {
      setVersions(window.electron.process.versions)
    }
  }, [])

  if (!versions) {
    return <div>Loading version info...</div>
  }

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron}</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
      <li className="node-version">Node v{versions.node}</li>
    </ul>
  )
}
