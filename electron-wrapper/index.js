const { app, BrowserWindow, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// Desabilita cache HTTP
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-application-cache');

// URL do projeto no Lovable / Vercel
const APP_URL = 'https://gestaosucena.vercel.app';

/**
 * Lê o tema salvo pelo app web para evitar flash de cor errada ao iniciar.
 * Salvo automaticamente quando a janela é fechada.
 * Fallback: tema do sistema operacional.
 */
function resolveAppTheme() {
  try {
    const prefsPath = path.join(app.getPath('userData'), 'sucena_theme_pref.json');
    if (fs.existsSync(prefsPath)) {
      const parsed = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
      if (parsed.theme === 'light' || parsed.theme === 'dark') return parsed.theme;
    }
  } catch { /* ignora */ }
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function createWindow() {
  const theme = resolveAppTheme();
  const isDark = theme === 'dark';

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    // Fundo correto para eliminar flash ao carregar o app
    backgroundColor: isDark ? '#0a0a0a' : '#eef0f4',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: isDark ? '#ffffff' : '#1c1d21',
      height: 28
    }
  });

  // Ocultar o menu padrão
  Menu.setApplicationMenu(null);
  win.maximize();

  // Salvar tema ao fechar
  win.on('close', () => {
    if (!win.isDestroyed()) {
      win.webContents.executeJavaScript(`
        (function() {
          try { return localStorage.getItem('sucena_theme') || 'light'; } catch(_) { return 'light'; }
        })()
      `).then((savedTheme) => {
        try {
          const prefsPath = require('path').join(require('electron').app.getPath('userData'), 'sucena_theme_pref.json');
          require('fs').writeFileSync(prefsPath, JSON.stringify({ theme: savedTheme }), 'utf-8');
        } catch { /* ignora */ }
      }).catch(() => {});
    }
  });

  // Carregar o site
  const buildUrl = `${APP_URL}?t=${Date.now()}`;
  win.loadURL(buildUrl).catch(() => {
    // Fallback caso falhe (sem internet) — se adapta ao tema ativo
    const bg = isDark ? '#0d0d0d' : '#f0f2f5';
    const cardBg = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#e4e6ea' : '#1c1d21';
    const subTextColor = isDark ? '#9ca3af' : '#6b7280';
    const btnBg = isDark ? '#c9a84c' : '#b88e28';
    const btnHoverBg = isDark ? '#d4b566' : '#a07820';
    const borderColor = isDark ? 'rgba(201,168,76,0.2)' : 'rgba(184,142,40,0.25)';
    const logoFilter = isDark ? 'brightness(0) invert(1) opacity(0.9)' : 'none';

    win.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Gestão Sucena - Sem Conexão</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: ${bg};
            color: ${textColor};
            transition: background 0.3s, color 0.3s;
          }
          .card {
            background: ${cardBg};
            border: 1px solid ${borderColor};
            border-radius: 24px;
            padding: 48px 52px;
            max-width: 440px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,${isDark ? '0.6' : '0.08'});
          }
          .icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: 2px solid ${btnBg};
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            background: ${isDark ? 'rgba(201,168,76,0.1)' : 'rgba(184,142,40,0.08)'};
          }
          .icon svg { stroke: ${btnBg}; }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.3px; }
          p { font-size: 14px; color: ${subTextColor}; line-height: 1.6; margin-bottom: 28px; }
          button {
            background: ${btnBg};
            color: #fff;
            border: none;
            border-radius: 12px;
            padding: 12px 28px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            letter-spacing: 0.02em;
          }
          button:hover { background: ${btnHoverBg}; }
          button:active { transform: scale(0.97); }
          .footer {
            margin-top: 20px;
            font-size: 11px;
            color: ${subTextColor};
            opacity: 0.6;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 6.5A4.5 4.5 0 0 1 8 3c1.8 0 3.37.9 4.33 2.27"/>
              <path d="M6 12a6 6 0 0 1 12 0"/>
              <path d="M3.5 14.5A4.5 4.5 0 0 0 8 18"/>
              <path d="M15 12a5 5 0 0 1 5 5"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          </div>
          <h1>Sem Conexão</h1>
          <p>Não foi possível carregar o Gestão Sucena.<br/>Verifique sua conexão com a internet e tente novamente.</p>
          <button onclick="window.location.reload()">Tentar Novamente</button>
          <p class="footer">Gestão Sucena v1.0.0</p>
        </div>
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

