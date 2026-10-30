import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Link2,
  Camera,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Image as ImageIcon,
  ArrowRight,
  Plus,
  Trash2,
  ExternalLink,
  UploadCloud,
  Check,
  Maximize2,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCintasStore, type Cinta } from '../store/cintasStore'
import {
  getMesInspecaoAtual,
  colorConfigs,
  compressImage,
  type CorCinta,
} from '../lib/cintasConfig'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Input } from './ui/input'
import { DateInput } from './ui/DateInput'
import { Label } from './ui/label'
import { toast } from 'sonner'
import { getWhatsappSettings } from '../lib/settings'
import { sendWhatsappTextOnServer } from '../lib/whatsapp-api'

export function DashboardCintasBanner() {
  const { cintas, hasHydrated, fetchCintas, inspecionarCinta } = useCintasStore()
  const [selectedCinta, setSelectedCinta] = useState<Cinta | null>(null)
  const [isBatchOpen, setIsBatchOpen] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  // Inspection form state
  const [dataInspecao, setDataInspecao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Batch selection state
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])

  useEffect(() => {
    if (!hasHydrated) {
      fetchCintas()
    }
  }, [hasHydrated, fetchCintas])

  const mesAtual = useMemo(() => getMesInspecaoAtual(), [])
  const corDoMes = mesAtual.cor
  const colorCfg = colorConfigs[corDoMes]

  // Cintas pertencentes à cor proibida do mês
  const cintasDoMes = useMemo(() => {
    return cintas.filter((c) => c.cor === corDoMes)
  }, [cintas, corDoMes])

  const inspecionadasComFoto = useMemo(() => {
    return cintasDoMes.filter((c) => c.status === 'Inspecionada' && !!c.foto)
  }, [cintasDoMes])

  const pendentes = useMemo(() => {
    return cintasDoMes.filter((c) => c.status !== 'Inspecionada')
  }, [cintasDoMes])

  const semFoto = useMemo(() => {
    return cintasDoMes.filter((c) => c.status === 'Inspecionada' && !c.foto)
  }, [cintasDoMes])

  const precisaAtencao = pendentes.length > 0 || semFoto.length > 0

  const handleOpenIndividual = (cinta: Cinta) => {
    setSelectedCinta(cinta)
    setDataInspecao(
      cinta.inspecionadaEm
        ? cinta.inspecionadaEm.split('/').reverse().join('-')
        : new Date().toISOString().split('T')[0]
    )
    setObservacoes('')

    let initialFotos: string[] = []
    if (cinta.foto) {
      try {
        const parsed = JSON.parse(cinta.foto)
        if (Array.isArray(parsed)) initialFotos = parsed
        else initialFotos = [cinta.foto]
      } catch {
        initialFotos = [cinta.foto]
      }
    }
    setFotos(initialFotos)
  }

  const handleOpenBatch = () => {
    // Pré-seleciona todas as que precisam de atenção (pendentes ou sem foto)
    const ids = cintasDoMes
      .filter((c) => c.status !== 'Inspecionada' || !c.foto)
      .map((c) => c.id)
    setSelectedBatchIds(ids.length > 0 ? ids : cintasDoMes.map((c) => c.id))
    setDataInspecao(new Date().toISOString().split('T')[0])
    setObservacoes('')
    setFotos([])
    setIsBatchOpen(true)
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
      toast.error('Erro ao processar imagem', { id: toastId })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveFoto = (indexToRemove: number) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSaveIndividual = async () => {
    if (!selectedCinta) return
    setIsSaving(true)
    try {
      const fotoPayload =
        fotos.length === 0 ? null : fotos.length === 1 ? fotos[0] : JSON.stringify(fotos)

      await inspecionarCinta(
        selectedCinta.id,
        dataInspecao,
        observacoes,
        'Inspecionada',
        fotoPayload
      )

      // WhatsApp notification
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
            const message = template
              .replace('{tag}', selectedCinta.tag)
              .replace('{descricao}', selectedCinta.descricao)
              .replace('{cor}', selectedCinta.cor)
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
        }
      } catch (waErr) {
        console.warn('Erro ao disparar WhatsApp de cintas:', waErr)
      }

      toast.success(`Inspeção e foto registradas para ${selectedCinta.tag}!`)
      setSelectedCinta(null)
      setFotos([])
    } catch (e) {
      console.error('Erro ao salvar inspeção de cinta:', e)
      toast.error('Erro ao salvar inspeção.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBatch = async () => {
    if (selectedBatchIds.length === 0) return
    setIsSaving(true)
    try {
      const fotoPayload =
        fotos.length === 0 ? null : fotos.length === 1 ? fotos[0] : JSON.stringify(fotos)

      await Promise.all(
        selectedBatchIds.map((id) =>
          inspecionarCinta(id, dataInspecao, observacoes, 'Inspecionada', fotoPayload)
        )
      )

      toast.success(`Inspeção registrada para ${selectedBatchIds.length} cinta(s)!`)
      setIsBatchOpen(false)
      setSelectedBatchIds([])
      setFotos([])
    } catch (e) {
      console.error('Erro ao salvar lote de cintas:', e)
      toast.error('Erro ao salvar inspeções.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!hasHydrated || cintasDoMes.length === 0) {
    return null
  }

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '20px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Barra lateral colorida de destaque com a cor proibida do mês */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '6px',
            backgroundColor: colorCfg.accentHex,
          }}
        />

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: `${colorCfg.accentHex}15`,
                display: 'grid',
                placeItems: 'center',
                color: colorCfg.accentHex,
              }}
            >
              <Link2 style={{ width: '22px', height: '22px' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 dark:text-white text-base tracking-tight">
                  Inspeção Mensal de Cintas de Elevação
                </h3>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs"
                  style={{ backgroundColor: colorCfg.accentHex }}
                >
                  Cor Proibida: {corDoMes}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  ({mesAtual.label})
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Neste mês todas as cintas da cor <strong>{corDoMes}</strong> devem ser inspecionadas e fotografadas com lacre atualizado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenBatch}
              className="text-xs rounded-xl border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Inspecionar em Lote
            </Button>
            <Link
              to="/seguranca/cintas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 transition-colors"
            >
              <span>Ver Vistoria</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Total Cintas {corDoMes}
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {cintasDoMes.length}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-green-50/70 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40">
            <span className="text-[11px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wider block">
              Inspecionadas c/ Foto
            </span>
            <span className="text-lg font-bold text-green-700 dark:text-green-300">
              {inspecionadasComFoto.length}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
              Sem Foto Anexada
            </span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {semFoto.length}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800/40">
            <span className="text-[11px] font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wider block">
              Aguardando Inspeção
            </span>
            <span className="text-lg font-bold text-orange-700 dark:text-orange-300">
              {pendentes.length}
            </span>
          </div>
        </div>

        {/* Straps Table / Cards List */}
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 px-2">
            <span>Cintas da cor {corDoMes} para inspeção neste mês:</span>
            <span>{precisaAtencao ? '⚠️ Requer ação' : '✅ Todas inspecionadas e com foto'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {cintasDoMes.map((c) => {
              const isInspec = c.status === 'Inspecionada'
              const hasPhoto = !!c.foto

              let previewImg: string | null = null
              if (hasPhoto) {
                try {
                  const p = JSON.parse(c.foto as string)
                  previewImg = Array.isArray(p) && p.length > 0 ? p[0] : (c.foto as string)
                } catch {
                  previewImg = c.foto as string
                }
              }

              return (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                >
                  {/* Left: Tag + Desc */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: colorCfg.accentHex }}
                      title={`Cor: ${c.cor}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                          {c.tag}
                        </span>
                        {isInspec ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Inspecionada
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {c.descricao}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {c.inspecionadaEm ? `Inspecionada em: ${c.inspecionadaEm}` : 'Aguardando vistoria'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Photo Preview & Action Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {previewImg ? (
                      <div className="relative group">
                        <img
                          src={previewImg}
                          alt={c.tag}
                          onClick={() => setExpandedImage(previewImg)}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-white/10 cursor-pointer group-hover:scale-105 transition-transform shadow-2xs"
                          title="Ver foto da inspeção"
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenIndividual(c)}
                          className="absolute -top-1 -right-1 bg-white dark:bg-black rounded-full p-0.5 shadow-xs border border-gray-200 dark:border-white/20 text-gray-600 dark:text-gray-300 hover:text-blue-500"
                          title="Alterar foto"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                        Sem foto
                      </span>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleOpenIndividual(c)}
                      className="text-xs h-8 px-2.5 rounded-lg text-white shadow-xs"
                      style={{
                        backgroundColor: hasPhoto ? '#4b5563' : colorCfg.accentHex,
                      }}
                    >
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      {hasPhoto ? 'Editar' : '+ Foto'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal Individual: Adicionar Foto / Registrar Inspeção */}
      <Dialog open={!!selectedCinta} onOpenChange={(open) => !open && setSelectedCinta(null)}>
        <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-serif text-gray-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" />
              {selectedCinta?.status === 'Inspecionada' ? 'Atualizar Foto e Inspeção' : 'Realizar Inspeção de Cinta'}
            </DialogTitle>
          </DialogHeader>

          {selectedCinta && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#151515] border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                    {selectedCinta.tag}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedCinta.descricao}</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-2xs"
                  style={{ backgroundColor: colorCfg.accentHex }}
                >
                  Cor: {selectedCinta.cor}
                </span>
              </div>

              {/* Data */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Data da Inspeção
                </Label>
                <DateInput
                  value={dataInspecao}
                  onChange={setDataInspecao}
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-sm"
                />
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Observações (opcional)
                </Label>
                <Input
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Cinta em perfeitas condições, lacre azul fixado..."
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-sm"
                />
              </div>

              {/* Upload Foto */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Foto da Cinta / Lacre do Mês ({fotos.length})
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
                    <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Tirar foto ou selecionar da galeria
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      Comprime automaticamente para salvar rápido
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.map((f, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5"
                      >
                        <img
                          src={f}
                          alt="Prévia"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setExpandedImage(f)}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFoto(idx)
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity"
                          title="Remover foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedCinta(null)}
              disabled={isSaving}
              className="rounded-xl border-gray-200 dark:border-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveIndividual}
              disabled={isSaving}
              className="rounded-xl text-white shadow-xs"
              style={{ backgroundColor: colorCfg.accentHex }}
            >
              {isSaving ? 'Salvando...' : 'Salvar Inspeção e Foto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Lote: Inspecionar e Adicionar Foto para Múltiplas Cintas */}
      <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
        <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10 sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-serif text-gray-900 dark:text-white flex items-center gap-2">
              <Check className="w-5 h-5 text-blue-500" />
              Inspeção em Lote — Cintas Cor {corDoMes}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Selecione as cintas da cor <strong>{corDoMes}</strong> que foram inspecionadas neste mês:
            </p>

            <div className="border border-gray-200 dark:border-white/10 rounded-xl divide-y divide-gray-100 dark:divide-white/5 max-h-48 overflow-y-auto">
              {cintasDoMes.map((c) => {
                const checked = selectedBatchIds.includes(c.id)
                return (
                  <label
                    key={c.id}
                    className="flex items-center justify-between p-2.5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedBatchIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <span className="font-mono font-bold text-gray-900 dark:text-white block">
                          {c.tag}
                        </span>
                        <span className="text-gray-500">{c.descricao}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {c.status === 'Inspecionada' ? 'Já inspecionada' : 'Pendente'}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Data da Inspeção
              </Label>
              <DateInput
                value={dataInspecao}
                onChange={setDataInspecao}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-sm"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Observações
              </Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações aplicáveis a todas as cintas selecionadas..."
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-sm"
              />
            </div>

            {/* Upload Foto do Lote */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Foto do Lote / Lacre ({fotos.length})
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
                  className="border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Camera className="w-6 h-6 text-blue-500 mb-1" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Anexar foto da inspeção do lote
                  </span>
                  <span className="text-[11px] text-gray-400">Opcional. Será vinculada às selecionadas.</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((f, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5"
                    >
                      <img
                        src={f}
                        alt="Prévia"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setExpandedImage(f)}
                      />
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
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsBatchOpen(false)}
              disabled={isSaving}
              className="rounded-xl border-gray-200 dark:border-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveBatch}
              disabled={isSaving || selectedBatchIds.length === 0}
              className="rounded-xl text-white shadow-xs"
              style={{ backgroundColor: colorCfg.accentHex }}
            >
              {isSaving ? 'Salvando...' : `Salvar (${selectedBatchIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Modal via Portal */}
      {expandedImage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ zIndex: 9999999 }}
            onClick={() => setExpandedImage(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-transparent rounded-2xl overflow-hidden flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={expandedImage}
                alt="Foto expandida"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
