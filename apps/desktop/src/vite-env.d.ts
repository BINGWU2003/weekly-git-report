/// <reference types="vite/client" />

interface ElectronAPI {
  readonly platform: string
  readonly versions: Readonly<{
    chrome: string
    electron: string
    node: string
  }>
}

interface Window {
  readonly electronAPI: ElectronAPI
}
