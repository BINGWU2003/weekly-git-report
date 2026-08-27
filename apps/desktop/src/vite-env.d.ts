/// <reference types="vite/client" />

import type { DesktopAPI } from '../shared/ipc'

declare global {
  interface Window {
    readonly electronAPI: DesktopAPI
  }
}

export {}
