import { useState, useEffect, useRef } from 'react';
import { X, Minus, Settings, Play, Download, CheckCircle, AlertTriangle, HardHat, Users, FileText } from 'lucide-react';

function App() {
  const [status, setStatus] = useState('Pronto para iniciar');
  const [progress, setProgress] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);
  const [launcherUpdate, setLauncherUpdate] = useState(false);
  const [isDownloadingLauncher, setIsDownloadingLauncher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopCountRef = useRef(0);

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
    <div className="h-screen w-screen flex flex-col rounded-2xl overflow-hidden shadow-2xl relative bg-transparent font-sans">
      
      {/* Background - Video em loop, proporcional, com som na 1ª vez */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          onEnded={() => {
            loopCountRef.current += 1;
            const vid = videoRef.current;
            if (vid) {
              vid.muted = loopCountRef.current >= 1; // muta a partir do 2º loop
              vid.play();
            }
          }}
          className="w-full h-full object-contain"
        >
          <source src="./videointro.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Invisible Drag Area at the top */}
      <div className="absolute top-0 left-0 right-0 h-12 z-40 drag-region" />

      {/* Floating window controls - top right */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-1 no-drag">
        <button
          onClick={() => window.electronAPI?.minimizeWindow()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm no-drag"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electronAPI?.closeWindow()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-red-500 text-white/80 hover:text-white transition-all backdrop-blur-sm no-drag"
        >
          <X size={14} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 px-8">
        <div className="flex-1 w-full" />

        {/* Bottom Panel - compacto */}
        <div className="mb-5 w-full rounded-xl border border-yellow-500/30 bg-[#0a0a0a]/85 backdrop-blur-xl px-4 py-2.5 flex items-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
          
          <button 
            onClick={handleStart}
            disabled={isUpdating || isDownloadingLauncher}
            className={`relative group px-8 py-2.5 rounded-lg font-bold text-base flex items-center gap-3 transition-all ${
              (isUpdating || isDownloadingLauncher)
                ? 'bg-white/5 text-white/50 cursor-not-allowed border border-white/10' 
                : 'bg-yellow-500 text-black hover:scale-[1.02] active:scale-95 shadow-[0_0_16px_rgba(234,179,8,0.4)] border border-yellow-300'
            }`}
          >
            {(isUpdating || isDownloadingLauncher) ? <Download size={18} className="animate-pulse" /> : <Play size={18} className="fill-black" />}
            {launcherUpdate 
              ? (isDownloadingLauncher ? 'ATUALIZANDO...' : 'ATUALIZAR LAUNCHER')
              : (isUpdating ? 'ATUALIZANDO...' : (isInstalled ? 'INICIAR SUCENA' : 'INSTALAR'))}
          </button>

          <div className="flex-1 ml-6 flex flex-col justify-center">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white drop-shadow-md">{status}</span>
              {isUpdating && <span className="text-xs font-bold text-yellow-500">{progress}%</span>}
            </div>
            
            {isUpdating ? (
              <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/5 mt-1.5">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 transition-all duration-200" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                {isInstalled ? (
                  <>
                    <CheckCircle size={13} className="text-green-500" />
                    <span className="text-white/50">Pronto para uso</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} className="text-yellow-500" />
                    <span className="text-white/50">Não instalado</span>
                  </>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 ml-4 hover:bg-white/5 rounded-lg transition-all text-white/40 hover:text-white border border-transparent hover:border-white/10" 
            title="Configurações"
          >
            <Settings size={20} />
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
