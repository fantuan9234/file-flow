export function getVersionInfo(): string {
  const versions = window.electron?.process?.versions
  
  if (!versions) {
    return 'Electron API not available'
  }
  
  return `Electron v${versions.electron} | Chromium v${versions.chrome} | Node v${versions.node}`
}

export function formatVersion(version: string): string {
  return `v${version}`
}
