import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let splashWindow;

// Função de sleep para o splash durar pelo menos um pouco
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createWindow() {
  // 1. Criar janela de Splash transparente
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  // 2. Aguardar a janela principal carregar o site hospedado
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Ocultar até carregar
    autoHideMenuBar: true, // Esconder o menu feio do windows
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Carregar o site diretamente
  mainWindow.loadURL('https://gestaosucena.vercel.app/');

  // Assim que estiver pronta, exibe a principal e fecha a splash
  mainWindow.webContents.once('did-finish-load', async () => {
    // Dá um tempinho extra na splash para charme
    await sleep(2000); 
    splashWindow.destroy();
    mainWindow.maximize();
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
