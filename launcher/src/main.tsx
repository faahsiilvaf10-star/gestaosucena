import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => void;
      closeWindow: () => void;
      checkForLauncherUpdates: () => Promise<any>;
      checkMainApp: () => Promise<{ installed: boolean; version: string | null }>;
      downloadMainApp: () => Promise<{ success: boolean; error?: string }>;
      launchMainApp: () => Promise<{ success: boolean; error?: string }>;
      repairApp: () => Promise<{ success: boolean }>;
      clearTemp: () => Promise<{ success: boolean }>;
      exportLogs: () => Promise<{ success: boolean }>;
      toggleStartWithWindows: (enable: boolean) => Promise<{ success: boolean }>;
      onDownloadProgress: (callback: (progress: number) => void) => void;
      onDownloadStatus: (callback: (status: string) => void) => void;
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
