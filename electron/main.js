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

  // 2. Criar a janela principal escondida, com bordas arredondadas e titlebar moderno
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

  // Carregar o site diretamente
  mainWindow.loadURL('https://gestaosucena.vercel.app/');

  // Assim que estiver pronta, exibe a principal e fecha a splash
  mainWindow.webContents.once('did-finish-load', async () => {
    
    // Injetar uma barra de título customizada no topo do site para arrastar a janela
    await mainWindow.webContents.executeJavaScript(`
      if (!document.getElementById('custom-electron-titlebar')) {
        const titlebar = document.createElement('div');
        titlebar.id = 'custom-electron-titlebar';
        titlebar.style.position = 'fixed';
        titlebar.style.top = '0';
        titlebar.style.left = '0';
        titlebar.style.width = '100%';
        titlebar.style.height = '28px';
        titlebar.style.backgroundColor = 'rgba(10, 10, 12, 0.65)'; // Transparente escura
        titlebar.style.backdropFilter = 'blur(12px)'; // Efeito Glass
        titlebar.style.webkitBackdropFilter = 'blur(12px)';
        titlebar.style.zIndex = '2147483647';
        titlebar.style.webkitAppRegion = 'drag';
        titlebar.style.display = 'flex';
        titlebar.style.alignItems = 'center';
        titlebar.style.justifyContent = 'center'; // Texto centralizado
        titlebar.style.boxSizing = 'border-box';
        titlebar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        
        const titleText = document.createElement('span');
        titleText.innerText = 'Sucena Empreendimentos';
        titleText.style.color = '#a1a1aa';
        titleText.style.fontFamily = 'system-ui, sans-serif';
        titleText.style.fontSize = '12px';
        titleText.style.fontWeight = '600';
        titleText.style.letterSpacing = '0.5px';
        titlebar.appendChild(titleText);
        
        document.body.appendChild(titlebar);
        
        // Empurrar o conteúdo do site para baixo
        document.body.style.paddingTop = '28px';
        
        // Ocultar a barra de rolagem padrão para ficar mais elegante
        const style = document.createElement('style');
        style.innerHTML = \`
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #0a0a0c; }
          ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #52525b; }
        \`;
        document.head.appendChild(style);
      }
    `);

    // Dá um tempinho extra na splash para charme
    await sleep(3500); 
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
