import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import extract from 'extract-zip';
import { exec } from 'child_process';
// __dirname is natively available in CommonJS

// Desabilita o cache HTTP do Chromium para sempre buscar a versão mais nova do servidor
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-application-cache');

/**
 * Lê o tema salvo pelo app web no perfil do Electron para evitar flash de cor
 * errada ao abrir a janela do sistema.
 * O app web persiste 'sucena_theme' = 'light' | 'dark' no localStorage,
 * que o Electron armazena em: userData/Default/Local Storage/leveldb/
 * Como ler localStorage raw é complexo, usamos um arquivo de preferência
 * simples gravado pelo próprio main quando o usuário fecha o app.
 * Fallback: respeitar o tema do sistema operacional.
 */
function resolveAppTheme(): 'light' | 'dark' {
  try {
    const prefsPath = path.join(app.getPath('userData'), 'sucena_theme_pref.json');
    if (fs.existsSync(prefsPath)) {
      const raw = fs.readFileSync(prefsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.theme === 'light' || parsed.theme === 'dark') return parsed.theme;
    }
  } catch { /* ignora erro de leitura */ }
  // Fallback: tema do sistema
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

let mainWindow: BrowserWindow | null = null;

const GITHUB_REPO = 'faahsiilvaf10-star/gestaosucena';
const APP_INSTALL_DIR = path.join(app.getPath('userData'), 'AppInstall');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../public/icon.ico')
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// --- LAUNCHER AUTO UPDATER ---
autoUpdater.autoDownload = false;

ipcMain.handle('check-for-launcher-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo ?? null;
  } catch {
    return null; // Silently fail - no updates config yet
  }
});

ipcMain.on('download-launcher-update', (event) => {
  const safeSend = (channel: string, ...args: any[]) => {
    try {
      if (!event.sender.isDestroyed()) event.sender.send(channel, ...args);
    } catch { /* ignore */ }
  };

  autoUpdater.on('download-progress', (progressObj) => {
    safeSend('download-progress', progressObj.percent);
    safeSend('download-status', 'Baixando atualização do Launcher...');
  });

  autoUpdater.on('update-downloaded', () => {
    safeSend('download-status', 'Atualização concluída! Reiniciando...');
    setTimeout(() => autoUpdater.quitAndInstall(), 1000);
  });

  autoUpdater.on('error', (err) => {
    safeSend('download-complete', { success: false, error: err.message });
  });

  autoUpdater.downloadUpdate();
});

// --- NATIVE HTTPS DOWNLOAD (avoids axios stream IPC crash) ---

function downloadFile(url: string, destPath: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (redirectUrl: string, depth: number) => {
      if (depth > 10) { reject(new Error('Too many redirects')); return; }

      const proto = redirectUrl.startsWith('https') ? https : http;
      proto.get(redirectUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, depth + 1);
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${redirectUrl}`));
          res.resume();
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        let lastPct = -1;
        const writer = fs.createWriteStream(destPath);

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = Math.round((downloaded / total) * 100);
            if (pct !== lastPct) {
              lastPct = pct;
              onProgress(pct);
            }
          }
        });

        res.on('error', (err) => { writer.destroy(); reject(err); });
        writer.on('error', (err) => { reject(err); });
        writer.on('finish', () => resolve());
        res.pipe(writer);
      }).on('error', reject);
    };

    follow(url, 0);
  });
}

// --- MAIN APP LOGIC ---

ipcMain.handle('check-main-app', async () => {
  // App is always available since it's a web app on Vercel
  return { installed: true, version: '1.0.0' };
});

const APP_URL = 'https://gestaosucena.vercel.app/';
let appWindow: BrowserWindow | null = null;

ipcMain.handle('launch-main-app', () => {
  // If already open, focus it
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.focus();
    return { success: true };
  }

  const theme = resolveAppTheme();
  const isDark = theme === 'dark';

  appWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    title: 'Gestão Sucena',
    autoHideMenuBar: true,
    show: true,
    // Usa a cor de fundo correta para o tema ativo, eliminando o flash de cor errada
    backgroundColor: isDark ? '#0a0a0a' : '#eef0f4',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      // Transparente para integrar com o header do app web
      color: '#00000000',
      symbolColor: isDark ? '#ffffff' : '#1c1d21',
      height: 28
    }
  });

  appWindow.setMenu(null);
  appWindow.maximize();
  const buildUrl = `${APP_URL}?t=${Date.now()}`;
  appWindow.loadURL(buildUrl);

  // Fecha o launcher quando o app principal abre
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }

  appWindow.on('closed', () => {
    appWindow = null;
  });

  // Salva o tema atual quando o app é fechado (para usar no próximo lançamento)
  appWindow.webContents.on('did-finish-load', () => {
    // Injeta script para capturar o tema e enviar para o main process via IPC
    appWindow?.webContents.executeJavaScript(`
      (function() {
        try {
          const t = localStorage.getItem('sucena_theme');
          if (t === 'light' || t === 'dark') {
            // Disponível apenas via contextBridge, mas aqui salvamos via cookie de sessão como fallback
            document.cookie = 'sucena_electron_theme=' + t + ';path=/';
          }
        } catch(_) {}
      })()
    `).catch(() => {});
  });

  // Intercepta navegação para salvar tema antes de fechar
  appWindow.on('close', () => {
    if (appWindow && !appWindow.isDestroyed()) {
      appWindow.webContents.executeJavaScript(`
        (function() {
          try { return localStorage.getItem('sucena_theme') || 'light'; } catch(_) { return 'light'; }
        })()
      `).then((theme: string) => {
        try {
          const prefsPath = require('path').join(require('electron').app.getPath('userData'), 'sucena_theme_pref.json');
          require('fs').writeFileSync(prefsPath, JSON.stringify({ theme }), 'utf-8');
        } catch { /* ignora erro de escrita */ }
      }).catch(() => {});
    }
  });

  // Open external links in default browser
  appWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('https://gestaosucena.vercel.app')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return { success: true };
});

// IPC para salvar preferência de tema explicitamente (chamado pelo app web se necessário)
ipcMain.on('save-theme-pref', (_event, theme: string) => {
  if (theme !== 'light' && theme !== 'dark') return;
  try {
    const prefsPath = path.join(app.getPath('userData'), 'sucena_theme_pref.json');
    fs.writeFileSync(prefsPath, JSON.stringify({ theme }), 'utf-8');
  } catch { /* ignora */ }
});

// Keep download handler for potential future use (offline installers)
ipcMain.on('start-download-main-app', (event) => {
  // Since the app is now web-based, just confirm success immediately
  try {
    if (!event.sender.isDestroyed()) {
      event.sender.send('download-complete', { success: true });
    }
  } catch { /* ignore */ }
});

// --- SETTINGS LOGIC ---
ipcMain.handle('repair-app', async () => {
  if (fs.existsSync(APP_INSTALL_DIR)) {
    fs.rmSync(APP_INSTALL_DIR, { recursive: true, force: true });
  }
  return { success: true };
});

ipcMain.handle('clear-temp', async () => {
  const session = mainWindow?.webContents.session;
  if (session) {
    await session.clearCache();
    await session.clearStorageData();
  }
  return { success: true };
});

ipcMain.handle('export-logs', async () => {
  if (!mainWindow) return { success: false };
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Logs Técnicos',
    defaultPath: 'gestaosucena-logs.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });
  if (filePath) {
    const logContent = [
      'Gestão Sucena Launcher - Logs Técnicos',
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      `Versão Launcher: ${app.getVersion()}`,
      `Diretório de Instalação: ${APP_INSTALL_DIR}`,
      `App instalado: ${fs.existsSync(path.join(APP_INSTALL_DIR, 'GestaoSucena.exe'))}`,
    ].join('\n');
    fs.writeFileSync(filePath, logContent, 'utf-8');
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('toggle-start-with-windows', (_event, enable: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') });
  return { success: true };
});
