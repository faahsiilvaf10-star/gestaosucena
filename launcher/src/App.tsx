import { useState, useEffect } from 'react';
import { X, Minus, Settings, Play, Download, CheckCircle, AlertTriangle, HardHat, Users, FileText } from 'lucide-react';

function App() {
  const [status, setStatus] = useState('Pronto para iniciar');
  const [progress, setProgress] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);
  const [launcherUpdate, setLauncherUpdate] = useState(false);
  const [isDownloadingLauncher, setIsDownloadingLauncher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onDownloadProgress((p: number) => setProgress(p));
    window.electronAPI.onDownloadStatus((s: string) => setStatus(s));
    
    window.electronAPI.onDownloadComplete((result: any) => {
      if (result.success) {
        setIsInstalled(true);
        setStatus('Pronto para iniciar');
      } else {
        setStatus('Erro: ' + result.error);
      }
      setIsUpdating(false);
    });

    window.electronAPI.checkForLauncherUpdates().then((updateInfo: any) => {
      if (updateInfo && updateInfo.version) {
        setLauncherUpdate(true);
        setStatus('Nova versão do instalador disponível!');
      }
    }).catch(() => {});
    
    // App is web-based, always available
    setIsInstalled(true);
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI) window.electronAPI.minimizeWindow();
  };

  const handleClose = () => {
    if (window.electronAPI) window.electronAPI.closeWindow();
  };

  const handleStart = async () => {
    if (!window.electronAPI) return;

    if (launcherUpdate) {
      setIsDownloadingLauncher(true);
      setStatus('Conectando e baixando atualização do instalador...');
      setProgress(0);
      window.electronAPI.downloadLauncherUpdate();
      return;
    }

    if (!isInstalled) {
      setIsUpdating(true);
      setStatus('Conectando aos servidores...');
      setProgress(0);
      window.electronAPI.startDownloadMainApp();
    } else {
      setStatus('Iniciando Gestão Sucena...');
      try {
        const res = await window.electronAPI.launchMainApp();
        if (!res.success) setStatus('Erro ao iniciar: ' + res.error);
      } catch (e: any) {
        setStatus('Erro: ' + e.message);
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col rounded-xl overflow-hidden shadow-2xl relative bg-black font-sans">
      
      {/* Background Image - no overlays, original colors preserved */}
      <div 
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{ backgroundImage: "url('./bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      />

      {/* Titlebar */}
      <div className="h-10 shrink-0 bg-black/40 backdrop-blur-sm flex items-center justify-between drag-region px-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-yellow-500 flex items-center justify-center font-bold text-[10px] text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]">
            GS
          </div>
          <span className="text-xs font-medium text-white/80 tracking-widest uppercase">GESTÃO SUCENA LAUNCHER</span>
        </div>
        <div className="flex items-center gap-1 no-drag">
          <button onClick={handleMinimize} className="p-2 hover:bg-white/10 rounded transition-colors text-white/70">
            <Minus size={16} />
          </button>
          <button onClick={handleClose} className="p-2 hover:bg-red-500/80 hover:text-white rounded transition-colors text-white/70">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 px-8">
        <div className="flex-1 w-full" />

        {/* Bottom Panel */}
        <div className="mb-8 w-full rounded-2xl border border-yellow-500/40 bg-[#0a0a0a]/80 backdrop-blur-xl p-4 flex items-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
          
          <button 
            onClick={handleStart}
            disabled={isUpdating || isDownloadingLauncher}
            className={`relative group px-12 py-4 rounded-xl font-bold text-xl flex items-center gap-4 transition-all ${
              (isUpdating || isDownloadingLauncher)
                ? 'bg-white/5 text-white/50 cursor-not-allowed border border-white/10' 
                : 'bg-yellow-500 text-black hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(234,179,8,0.4)] border border-yellow-300'
            }`}
          >
            {(isUpdating || isDownloadingLauncher) ? <Download size={24} className="animate-pulse" /> : <Play size={24} className="fill-black" />}
            {launcherUpdate 
              ? (isDownloadingLauncher ? 'ATUALIZANDO...' : 'ATUALIZAR LAUNCHER')
              : (isUpdating ? 'ATUALIZANDO...' : (isInstalled ? 'INICIAR SUCENA' : 'INSTALAR'))}
          </button>

          <div className="flex-1 ml-8 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1">
              <span className="text-lg font-medium text-white shadow-black drop-shadow-md">{status}</span>
              {isUpdating && <span className="text-sm font-bold text-yellow-500">{progress}%</span>}
            </div>
            
            {isUpdating ? (
              <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden border border-white/5 mt-2">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 transition-all duration-200" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm mt-1">
                {isInstalled ? (
                  <>
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="text-white/60">Pronto para uso</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-yellow-500" />
                    <span className="text-white/60">Não instalado</span>
                  </>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowSettings(true)}
            className="p-4 ml-6 hover:bg-white/5 rounded-xl transition-all text-white/50 hover:text-white border border-transparent hover:border-white/10" 
            title="Configurações"
          >
            <Settings size={28} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#151515]">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Settings size={22} className="text-yellow-500" />
                Configurações
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5 bg-[#0a0a0a]">
              
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="font-semibold text-white/90 text-sm">Iniciar com o Windows</h3>
                  <p className="text-xs text-white/40 mt-1">Abrir o launcher automaticamente</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    onChange={(e) => {
                      if (window.electronAPI) window.electronAPI.toggleStartWithWindows(e.target.checked);
                    }} 
                  />
                  <div className="w-12 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>

              <div className="space-y-3 mt-2">
                <button 
                  onClick={() => {
                    window.electronAPI?.repairApp().then(() => {
                      alert('App reparado! Reinicie o Launcher.');
                      setShowSettings(false);
                    });
                  }}
                  className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-medium text-white transition-all text-left flex items-center justify-between group">
                  Verificar Reparo de Arquivos
                  <Settings size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                  onClick={() => {
                    window.electronAPI?.clearTemp().then(() => {
                      alert('Arquivos temporários limpos com sucesso.');
                    });
                  }}
                  className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-medium text-white transition-all text-left flex items-center justify-between group">
                  Limpar Arquivos Temporários
                  <Settings size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                  onClick={() => {
                    window.electronAPI?.exportLogs().then((res: any) => {
                      if (res.success) alert('Logs exportados com sucesso!');
                    });
                  }}
                  className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-medium text-white transition-all text-left flex items-center justify-between group">
                  Exportar Logs Técnicos
                  <Settings size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
