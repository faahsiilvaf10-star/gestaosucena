import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  checkForLauncherUpdates: () => ipcRenderer.invoke('check-for-launcher-updates'),
  downloadLauncherUpdate: () => ipcRenderer.send('download-launcher-update'),
  checkMainApp: () => ipcRenderer.invoke('check-main-app'),
  // Fire-and-forget download — result comes via onDownloadComplete
  startDownloadMainApp: () => ipcRenderer.send('start-download-main-app'),
  launchMainApp: () => ipcRenderer.invoke('launch-main-app'),
  repairApp: () => ipcRenderer.invoke('repair-app'),
  clearTemp: () => ipcRenderer.invoke('clear-temp'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  toggleStartWithWindows: (enable: boolean) => ipcRenderer.invoke('toggle-start-with-windows', enable),
  onDownloadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  },
  onDownloadStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('download-status', (_event, status) => callback(status));
  },
  onDownloadComplete: (callback: (result: { success: boolean; error?: string }) => void) => {
    ipcRenderer.on('download-complete', (_event, result) => callback(result));
  },
});
