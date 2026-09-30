import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

// Desabilita o cache HTTP do Chromium para sempre buscar a versão mais nova do servidor
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-application-cache');

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

  // Limpa o cache da sessão na inicialização para garantir conteúdo fresco
  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData({ storages: ['appcache', 'cachestorage'] });
  
  // Carregar o site diretamente (com cache-buster na URL para forçar nova versão)
  const buildUrl = `https://gestaosucena.vercel.app/?t=${Date.now()}`;
  mainWindow.loadURL(buildUrl);

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
        titlebar.style.backgroundColor = 'rgba(10, 10, 12, 0.65)';
        titlebar.style.backdropFilter = 'blur(12px)';
        titlebar.style.webkitBackdropFilter = 'blur(12px)';
        // z-index abaixo dos popups de notificação (z-[200] = 200)
        // mas acima do conteúdo normal da página
        titlebar.style.zIndex = '150';
        titlebar.style.webkitAppRegion = 'drag';
        titlebar.style.display = 'flex';
        titlebar.style.alignItems = 'center';
        titlebar.style.justifyContent = 'center';
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
