import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Camera from 'lucide-react/dist/esm/icons/camera.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCintasStore, Cinta } from '../../store/cintasStore'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/DateInput'
import { Label } from '@/components/ui/label'
import { getWhatsappSettings } from '../../lib/settings'
import { sendWhatsappTextOnServer } from '../../lib/whatsapp-api'
import { toast } from 'sonner'
import {
  getMesInspecaoAtual,
  colorConfigs,
  compressImage,
  isInspecionadaNesteMes,
  type CorCinta,
} from '../../lib/cintasConfig'

export function AlertaInspecaoMensal() {
  const navigate = useNavigate()
  const { cintas, hasHydrated, inspecionarCinta, fetchCintas } = useCintasStore()
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!hasHydrated) fetchCintas()
  }, [hasHydrated, fetchCintas])

  const mesAtualInfo = getMesInspecaoAtual()
  const currentMonthLabel = mesAtualInfo.label
  const corDoMes = mesAtualInfo.cor
  const colorCfg = colorConfigs[corDoMes]

  const cintasPendentes = useMemo(() => {
    return cintas.filter((c) => c.cor === corDoMes && (!isInspecionadaNesteMes(c) || !c.foto))
  }, [cintas, corDoMes])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dataInspecao, setDataInspecao] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')

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

      const listaCintas = pendentes.map((c) => `• ${c.tag} — ${c.descricao}`).join('\n')
      const template = waSettings.messageTemplates?.cintasAvisoMensal || ''
      const message = template
        .replace('{mes}', currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1))
        .replace('{cor}', corDoMes)
        .replace('{lista_cintas}', listaCintas)

      await sendWhatsappTextOnServer({
        data: {
          url: waSettings.url,
          token: waSettings.token,
          instanceId: waSettings.instanceId,
          phone: groupId,
          text: message,
        },
      })
    } catch (e) {
      console.error('Erro ao enviar aviso mensal de cintas:', e)
    }
  }

  if (!hasHydrated || cintasPendentes.length === 0) return null

  const handleOpen = () => {
    setIsOpen(true)
    setSelectedIds(cintasPendentes.map((c) => c.id))
    setDataInspecao(new Date().toISOString().split('T')[0])
    setObservacoes('')
    setFotos([])
  }

  const toggleCinta = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    )
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const toastId = toast.loading('Otimizando foto...')
    try {
      const newUrls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i])
        newUrls.push(compressed)
      }
      setFotos((prev) => [...prev, ...newUrls])
      toast.success(newUrls.length > 1 ? 'Fotos adicionadas!' : 'Foto adicionada!', { id: toastId })
    } catch (err) {
      console.error('Erro ao comprimir imagem:', err)
      toast.error('Erro ao carregar imagem', { id: toastId })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSaveBatch = async () => {
    setIsSending(true)

    const fotoPayload =
      fotos.length === 0 ? null : fotos.length === 1 ? fotos[0] : JSON.stringify(fotos)

    // 1. Save to DB
    try {
      await Promise.all(
        selectedIds.map((id) =>
          inspecionarCinta(id, dataInspecao, observacoes, 'Inspecionada', fotoPayload)
        )
      )
    } catch (e) {
      toast.error('Ocorreu um erro ao salvar no banco de dados.')
      setIsSending(false)
      return
    }

    // 2. Send WhatsApp notification for each inspected strap
    try {
      const waSettings = await getWhatsappSettings()
      if (
        waSettings.cintasInspection?.enabled &&
        waSettings.url &&
        waSettings.token &&
        waSettings.instanceId
      ) {
        const groupId = waSettings.cintasInspection.specificGroupId || waSettings.groupId
        if (groupId) {
          const template = waSettings.messageTemplates?.cintasInspecionada || ''
          const dataFmt = dataInspecao.split('-').reverse().join('/')

          for (const id of selectedIds) {
            const cinta = cintasPendentes.find((c) => c.id === id)
            if (!cinta) continue

            const message = template
              .replace('{tag}', cinta.tag)
              .replace('{descricao}', cinta.descricao)
              .replace('{cor}', cinta.cor)
              .replace('{data}', dataFmt)
              .replace('{responsavel}', 'Você')

            await sendWhatsappTextOnServer({
              data: {
                url: waSettings.url,
                token: waSettings.token,
                instanceId: waSettings.instanceId,
                phone: groupId,
                text: message,
              },
            })
          }
          toast.success(`Notificação enviada ao grupo do WhatsApp!`)
        }
      }
    } catch (e) {
      console.error('Erro ao enviar confirmação de inspeção:', e)
    }

    setIsSending(false)
    setIsOpen(false)
    setFotos([])
  }

  return (
    <>
      <div
        className="rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full relative overflow-hidden border"
        style={{
          backgroundColor: `${colorCfg.accentHex}10`,
          borderColor: `${colorCfg.accentHex}40`,
        }}
      >
        <div
          className="absolute left-0 top-0 w-1.5 h-full"
          style={{ backgroundColor: colorCfg.accentHex }}
        />

        <div className="flex items-start sm:items-center gap-4">
          <div
            className="p-3 rounded-full shrink-0"
            style={{
              backgroundColor: `${colorCfg.accentHex}20`,
              color: colorCfg.accentHex,
            }}
          >
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                Inspeção Mensal Obrigatória — Cor Proibida do Mês: {corDoMes}
              </h3>
              <span
                className="px-2 py-0.5 rounded text-xs font-bold text-white shadow-2xs"
                style={{ backgroundColor: colorCfg.accentHex }}
              >
                {mesAtualInfo.label}
              </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm mt-0.5">
              {cintasPendentes.length} cinta(s) da cor {corDoMes} aguardando inspeção ou anexo da foto do lacre.
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpen}
          className="text-white rounded-xl shadow-sm whitespace-nowrap px-6 shrink-0"
          style={{ backgroundColor: colorCfg.accentHex }}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Inspecionar Cintas
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10 sm:max-w-[600px] max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-serif tracking-tight text-[#1c1d21] dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              Realizar Inspeção em Lote — Cor {corDoMes}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">

            {/* Cintas List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">
                Selecione as cintas inspecionadas ({selectedIds.length} de {cintasPendentes.length}):
              </Label>
              <div className="border border-gray-200 dark:border-white/10 rounded-xl divide-y divide-gray-100 dark:divide-white/5 bg-gray-50/50 dark:bg-[#111] max-h-[250px] overflow-y-auto custom-scrollbar">
                {cintasPendentes.map((c) => (
                  <label key={c.id} className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleCinta(c.id)}
                    />
                    <div className="ml-3 flex flex-col flex-1">
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-200">{c.tag}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{c.descricao}</span>
                    </div>
                    {!c.foto && c.status === 'Inspecionada' && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                        Sem foto
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">Data da Inspeção</Label>
              <DateInput
                value={dataInspecao}
                onChange={setDataInspecao}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-[#1c1d21] dark:text-white"
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">Observações Gerais</Label>
              <Input
                placeholder="Descreva observações aplicáveis às cintas selecionadas..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-[#1c1d21] dark:text-white"
              />
            </div>

            {/* Foto Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">
                  Comprovante / Foto da Inspeção ({fotos.length})
                </Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar foto
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {fotos.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <ImageIcon className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center">
                    <Camera className="w-4 h-4 mr-2" /> Enviar foto da inspeção / lacre
                  </span>
                  <p className="text-xs text-gray-500 mt-1">Opcional. Comprime automaticamente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((f, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5"
                    >
                      <img src={f} alt="Prévia" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFoto(idx)
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-90 hover:opacity-100"
                        title="Remover foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              className="text-white rounded-xl shadow-sm"
              style={{ backgroundColor: colorCfg.accentHex }}
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
