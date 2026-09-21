import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, Save, Camera, Image as ImageIcon, MessageCircle } from 'lucide-react'
import { useCintasStore, Cinta } from '../../store/cintasStore'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/DateInput'
import { Label } from '@/components/ui/label'
import { getWhatsappSettings } from '../../lib/settings'
import { sendWhatsappTextOnServer } from '../../lib/whatsapp-api'
import { toast } from 'sonner'

const mesesInspecao = [
  { label: 'janeiro de 2026', cor: 'Vermelho' as const },
  { label: 'fevereiro de 2026', cor: 'Azul' as const },
  { label: 'março de 2026', cor: 'Amarelo' as const },
  { label: 'abril de 2026', cor: 'Verde' as const },
  { label: 'maio de 2026', cor: 'Vermelho' as const },
  { label: 'junho de 2026', cor: 'Azul' as const },
  { label: 'julho de 2026', cor: 'Amarelo' as const },
  { label: 'agosto de 2026', cor: 'Verde' as const },
  { label: 'setembro de 2026', cor: 'Vermelho' as const },
  { label: 'outubro de 2026', cor: 'Azul' as const },
  { label: 'novembro de 2026', cor: 'Amarelo' as const },
  { label: 'dezembro de 2026', cor: 'Verde' as const },
]

function isInspecionadaNesteMes(cinta: Cinta, referenceDate = new Date()) {
  if (cinta.status !== 'Inspecionada' || !cinta.inspecionadaEm) return false

  const [day, month, year] = cinta.inspecionadaEm.split('/').map(Number)
  return year === referenceDate.getFullYear() && month === referenceDate.getMonth() + 1 && day > 0
}

async function sendWhatsappMessage(url: string, token: string, instanceId: string, groupId: string, message: string) {
  try {
    const result = await sendWhatsappTextOnServer({
      data: {
        url,
        token,
        instanceId,
        phone: groupId,
        text: message,
      },
    })
    if (!result.success) {
      console.error('WhatsApp API error:', result.error || result.result)
    }
    return result.success
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return false
  }
}

export function AlertaInspecaoMensal() {
  const navigate = useNavigate()
  const { cintas, hasHydrated, inspecionarCinta, fetchCintas } = useCintasStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!hasHydrated) fetchCintas()
  }, [hasHydrated, fetchCintas])

  const currentMonthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())
  const corDoMes = mesesInspecao.find(m => m.label === currentMonthLabel)?.cor || 'Vermelho'

  const cintasPendentes = useMemo(() => {
    return cintas.filter(c => c.cor === corDoMes && !isInspecionadaNesteMes(c))
  }, [cintas, corDoMes])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dataInspecao, setDataInspecao] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState("")

  // Send the day-1 monthly alert automatically once when the card first shows
  useEffect(() => {
    const hoje = new Date().getDate()
    if (hoje !== 1) return // Only on day 1
    if (cintasPendentes.length === 0) return

    const storageKey = `cintas_wapp_sent_${currentMonthLabel}`
    if (sessionStorage.getItem(storageKey)) return // Already sent this session

    sessionStorage.setItem(storageKey, 'true')

    // Fire and forget — don't block rendering
    sendMonthlyAlert(cintasPendentes)
  }, [cintasPendentes.length])

  async function sendMonthlyAlert(pendentes: Cinta[]) {
    try {
      const waSettings = await getWhatsappSettings()
      if (!waSettings.cintasInspection?.enabled) return
      if (!waSettings.url || !waSettings.token) return

      const groupId = waSettings.cintasInspection.specificGroupId || waSettings.groupId
      if (!groupId) return

      const listaCintas = pendentes.map(c => `• ${c.tag} — ${c.descricao}`).join('\n')
      const template = waSettings.messageTemplates?.cintasAvisoMensal || ''
      const message = template
        .replace('{mes}', currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1))
        .replace('{cor}', corDoMes)
        .replace('{lista_cintas}', listaCintas)

      await sendWhatsappMessage(waSettings.url, waSettings.token, waSettings.instanceId, groupId, message)
    } catch (e) {
      console.error('Erro ao enviar aviso mensal de cintas:', e)
    }
  }

  if (!hasHydrated || cintasPendentes.length === 0) return null

  const handleOpen = () => {
    setIsOpen(true)
    setSelectedIds(cintasPendentes.map(c => c.id))
    setDataInspecao(new Date().toISOString().split('T')[0])
    setObservacoes("")
  }

  const toggleCinta = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    )
  }

  const handleSaveBatch = async () => {
    setIsSending(true)

    // 1. Save to DB
    try {
      await Promise.all(selectedIds.map(id => 
        inspecionarCinta(id, dataInspecao, observacoes, 'Inspecionada')
      ))
    } catch (e) {
      toast.error('Ocorreu um erro ao salvar no banco de dados.')
      setIsSending(false)
      return
    }

    // 2. Send WhatsApp notification for each inspected strap
    try {
      const waSettings = await getWhatsappSettings()
      if (waSettings.cintasInspection?.enabled && waSettings.url && waSettings.token && waSettings.instanceId) {
        const groupId = waSettings.cintasInspection.specificGroupId || waSettings.groupId
        if (groupId) {
          const template = waSettings.messageTemplates?.cintasInspecionada || ''
          const dataFmt = dataInspecao.split('-').reverse().join('/')

          let allSent = true
          for (const id of selectedIds) {
            const cinta = cintasPendentes.find(c => c.id === id)
            if (!cinta) continue

            const message = template
              .replace('{tag}', cinta.tag)
              .replace('{descricao}', cinta.descricao)
              .replace('{cor}', cinta.cor)
              .replace('{data}', dataFmt)
              .replace('{responsavel}', 'Você')

            const sent = await sendWhatsappMessage(waSettings.url, waSettings.token, waSettings.instanceId, groupId, message)
            allSent = allSent && sent
          }
          if (allSent) {
            toast.success(`Notificação enviada ao grupo do WhatsApp!`)
          } else {
            toast.error('A inspeção foi salva, mas não foi possível enviar todas as notificações ao WhatsApp.')
          }
        }
      } else {
        toast.error('A inspeção foi salva, mas o WhatsApp não está configurado ou ativado.')
      }
    } catch (e) {
      console.error('Erro ao enviar confirmação de inspeção:', e)
      toast.error('A inspeção foi salva, mas houve erro no envio ao WhatsApp.')
    }

    setIsSending(false)
    setIsOpen(false)
    navigate({ to: '/seguranca/cintas' })
  }

  return (
    <>
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full relative overflow-hidden">
        <div className="absolute left-0 top-0 w-1.5 h-full bg-red-500"></div>

        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-300 text-lg">
              Inspeção Mensal Obrigatória — Cor {corDoMes}
            </h3>
            <p className="text-red-700 dark:text-red-400/80 text-sm mt-0.5">
              {cintasPendentes.length} cinta(s) aguardando inspeção. A inspeção deve ser feita no primeiro dia do mês.
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpen}
          className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm whitespace-nowrap px-6 shrink-0"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Inspecionar Cintas
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10 sm:max-w-[600px] max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-serif tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Realizar Inspeção em Lote
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">

            {/* Cintas List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-white">
                Selecione as cintas inspecionadas ({selectedIds.length} de {cintasPendentes.length}):
              </Label>
              <div className="border border-gray-200 dark:border-white/10 rounded-xl divide-y divide-gray-100 dark:divide-white/5 bg-gray-50/50 dark:bg-[#111] max-h-[250px] overflow-y-auto custom-scrollbar">
                {cintasPendentes.map(c => (
                  <label key={c.id} className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleCinta(c.id)}
                    />
                    <div className="ml-3 flex flex-col flex-1">
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-200">{c.tag}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{c.descricao}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-white">Data da Inspeção</Label>
              <DateInput
                value={dataInspecao}
                onChange={setDataInspecao}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-white">Observações Gerais</Label>
              <Input
                placeholder="Descreva observações aplicáveis às cintas selecionadas..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              />
            </div>

            {/* Foto */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-white">Comprovante / Foto</Label>
              <div className="border border-dashed border-gray-300 dark:border-white/20 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <ImageIcon className="w-6 h-6 text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center">
                  <Camera className="w-4 h-4 mr-2" /> Enviar foto da inspeção
                </span>
                <p className="text-xs text-gray-500 mt-1">Opcional. Máximo de 5MB.</p>
              </div>
            </div>

            {/* WhatsApp info */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
              <span>Se a integração com WhatsApp estiver ativa no painel Admin, uma confirmação será enviada ao grupo configurado automaticamente.</span>
            </div>

          </div>

          <DialogFooter className="mt-6 border-t border-gray-100 dark:border-white/5 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border-gray-200 dark:border-white/10"
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveBatch}
              disabled={selectedIds.length === 0 || isSending}
              className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl shadow-sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSending ? 'Salvando...' : `Salvar Inspeção (${selectedIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
