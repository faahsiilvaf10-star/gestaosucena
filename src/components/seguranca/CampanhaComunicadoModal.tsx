import { useState, useEffect } from 'react'
import { getCampanhaAtual, type CampanhaData } from '../../lib/campanhasData'
import { notificarCampanhaMesAutomatico } from '../../lib/campanhasWhatsapp'

export function CampanhaComunicadoModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [campanha, setCampanha] = useState<CampanhaData | null>(null)

  useEffect(() => {
    const verificar = async () => {
      try {
        const hoje = new Date()
        const diaDoMes = hoje.getDate()
        const mesNum = hoje.getMonth() + 1
        const anoNum = hoje.getFullYear()
        const storageKey = `campanha_comunicado_lido_${anoNum}_${mesNum}`

        const lido = localStorage.getItem(storageKey)

        // Se for dia 01 ou primeira entrada do mês sem confirmação
        if (!lido || diaDoMes === 1) {
          const c = getCampanhaAtual()
          setCampanha(c)
          setIsOpen(true)

          // Toca som de comunicado se disponível
          try {
            const audio = new Audio('/comunicado.mp3')
            audio.volume = 0.6
            audio.play().catch(() => {})
          } catch (_) {}
        }

        // Dispara envio automático no WhatsApp da virada do mês/dia 01
        void notificarCampanhaMesAutomatico(false)
      } catch (err) {
        console.warn('[CampanhaComunicadoModal] Erro ao verificar comunicado:', err)
      }
    }

    // Checagem imediata ao carregar a aplicação
    verificar()
  }, [])

  const fechar = () => {
    if (!campanha) {
      setIsOpen(false)
      return
    }
    const hoje = new Date()
    const mesNum = hoje.getMonth() + 1
    const anoNum = hoje.getFullYear()
    localStorage.setItem(`campanha_comunicado_lido_${anoNum}_${mesNum}`, 'true')
    setIsOpen(false)
  }

  if (!isOpen || !campanha) return null

  return (
    <div className="comunicado-overlay" role="dialog" aria-modal="true">
      <div className="comunicado flex flex-col max-h-[92vh] overflow-hidden">
        <img src="/logo-relatorio.png" alt="Sucena" className="comunicado-logo" />

        {/* Faixa temática na cor da campanha */}
        <div
          className="h-2 w-full shrink-0"
          style={{ background: campanha.stripGradient || campanha.cor }}
        />

        {/* Cabeçalho */}
        <div className="comunicado-titulo pb-3">
          <span className="comunicado-icone" aria-hidden="true">
            🎗️
          </span>
          <div className="min-w-0">
            <h2 className="m-0 p-0 text-[20px] sm:text-[22px] font-[900] leading-tight text-[#111111]">
              Campanha do Mês: {campanha.camp}
            </h2>
            <p className="text-gray-600 font-bold text-xs mt-0.5">
              Conscientização Mensal de Segurança e Saúde • {campanha.mes}
            </p>
          </div>
        </div>

        {/* Conteúdo com scroll se necessário */}
        <div className="comunicado-conteudo overflow-y-auto custom-scrollbar flex-1 pt-1 pb-2">
          {/* Arte oficial ou Placeholder */}
          {campanha.imagem ? (
            <div className="w-full max-h-60 sm:max-h-72 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 mb-3 flex items-center justify-center">
              <img
                src={campanha.imagem}
                alt={campanha.camp}
                className="w-full h-full object-contain max-h-60 sm:max-h-72"
              />
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-gray-100 border border-dashed border-gray-300 text-center mb-3">
              <span className="text-4xl block mb-1">🎗️</span>
              <strong className="text-sm font-black text-black block">{campanha.camp}</strong>
              <span className="text-xs font-semibold text-gray-600">Espaço reservado para a arte deste mês</span>
            </div>
          )}

          {/* Tema e Conscientização */}
          <div className="mb-2.5">
            <span
              className="inline-block text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full text-white mb-1.5"
              style={{ background: campanha.cor }}
            >
              {campanha.mes}
            </span>
            <h3 className="text-sm sm:text-base font-black text-black leading-snug">
              💡 Conscientização: {campanha.tema}
            </h3>
          </div>

          <p className="text-gray-800 text-xs sm:text-sm font-semibold leading-relaxed mb-2.5">
            {campanha.desc}
          </p>

          <p className="text-xs sm:text-sm font-bold text-black italic border-l-4 border-amber-400 pl-3 py-0.5 bg-amber-50/50 rounded-r">
            “{campanha.frase}”
          </p>
        </div>

        {/* Rodapé com botão Entendi dourado */}
        <div className="comunicado-rodape pt-2">
          <div className="comunicado-acoes justify-center sm:justify-end">
            <button
              type="button"
              onClick={fechar}
              className="comunicado-botao-entendi w-full sm:w-auto"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

