import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

// Desabilita o cache HTTP do Chromium para sempre buscar a versão mais nova do servidor
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-application-cache');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let launcherWindow;

// Função de sleep para o splash durar pelo menos um pouco
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createWindow() {
  // 1. Criar janela do Launcher
  launcherWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await launcherWindow.loadFile(path.join(__dirname, 'launcher.html'));
}

ipcMain.on('launch-app', () => {
  // 2. Criar a janela principal escondida, sem barra no topo
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000', // Transparente para o glass aparecer
      symbolColor: '#ffffff', // Cor dos botões de fechar/minimizar
      height: 28
    },
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Carregar o site diretamente (com cache-buster na URL para forçar nova versão)
  const buildUrl = `https://gestaosucena.vercel.app/?t=${Date.now()}`;
  mainWindow.loadURL(buildUrl);

  // Assim que estiver pronta, exibe a principal e fecha o launcher
  const showMainWindow = async () => {
    // Injetar uma área de drag customizada transparente
    await mainWindow.webContents.executeJavaScript(`
      if (!document.getElementById('custom-electron-titlebar')) {
        const titlebar = document.createElement('div');
        titlebar.id = 'custom-electron-titlebar';
        titlebar.style.position = 'fixed';
        titlebar.style.top = '0';
        titlebar.style.left = '0';
        titlebar.style.width = '100%';
        titlebar.style.height = '28px';
        titlebar.style.backgroundColor = 'transparent';
        titlebar.style.zIndex = '150';
        titlebar.style.webkitAppRegion = 'drag';
        
        document.body.appendChild(titlebar);
        
        // Empurra apenas o wrapper principal do app (não o body)
        // para não afetar o posicionamento de elementos fixed
        const appRoot = document.getElementById('root') || document.querySelector('#app') || document.body;
        if (appRoot && appRoot !== document.body) {
          appRoot.style.paddingTop = '28px';
        } else {
          document.body.style.paddingTop = '28px';
        }
        
        // Estiliza a scrollbar para ficar mais elegante
        const style = document.createElement('style');
        style.innerHTML = \\\`
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #0a0a0c; }
          ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #52525b; }
        \\\`;
        document.head.appendChild(style);
      }
    `).catch(err => console.log('Erro ao injetar drag area:', err));

    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.destroy();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  };

  mainWindow.webContents.once('dom-ready', showMainWindow);
  // Fallback: se a página demorar mais de 3 segundos para reportar 'dom-ready', força a exibição
  setTimeout(showMainWindow, 3000);
});

app.whenReady().then(() => {
  // Desabilita cache HTTP para garantir que o EXE sempre carregue
  // a versão mais recente do site (sem CSS/JS antigo do Vercel)
  session.defaultSession.clearCache()
  session.defaultSession.clearStorageData({ storages: ['appcache'] })

  // Configura cache para revalidar sempre
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    details.requestHeaders['Pragma'] = 'no-cache'
    callback({ requestHeaders: details.requestHeaders })
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true); // Permite todas as permissões (geolocation, notifications, etc.)
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
