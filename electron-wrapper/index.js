const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// URL do projeto no Lovable
const APP_URL = 'https://gestaosucena.lovable.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  // Ocultar o menu padrão
  Menu.setApplicationMenu(null);

  // Carregar o site
  win.loadURL(APP_URL).catch(() => {
    // Fallback caso falhe (sem internet)
    win.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f9fafb;">
          <h2>Sem Conexão</h2>
          <p>Não foi possível carregar o sistema. Verifique sua conexão com a internet e tente novamente.</p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer;">Tentar Novamente</button>
        </body>
      </html>
    `));
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
