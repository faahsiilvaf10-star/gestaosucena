import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Filter from 'lucide-react/dist/esm/icons/funnel.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet.js';
import Camera from 'lucide-react/dist/esm/icons/camera.js';
import Edit from 'lucide-react/dist/esm/icons/square-pen.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import X from 'lucide-react/dist/esm/icons/x.js'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCintasStore } from '../../store/cintasStore'
import { AlertaInspecaoMensal } from '../../components/seguranca/AlertaInspecaoMensal'
import { DateInput } from '../../components/ui/DateInput'
import {
  mesesInspecao,
  colorConfigs,
  getMesInspecaoAtual,
  type CorCinta,
} from '../../lib/cintasConfig'

export const Route = createFileRoute('/seguranca/cintas')({
  component: VistoriaCintas,
})

const colorMap: Record<string, string> = {
  'Vermelho': 'bg-red-500',
  'Azul': 'bg-blue-500',
  'Amarelo': 'bg-yellow-500',
  'Verde': 'bg-green-500',
}

function VistoriaCintas() {
  const { cintas, historico, inspecionarCinta, adicionarCinta, removerCinta, fetchCintas, hasHydrated } = useCintasStore()
  const [editingCinta, setEditingCinta] = useState<any | null>(null)

  // Nova Cinta modal state
  const [isNovaCintaOpen, setIsNovaCintaOpen] = useState(false)
  const [novaTag, setNovaTag] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaCor, setNovaCor] = useState<'Vermelho' | 'Azul' | 'Amarelo' | 'Verde'>('Vermelho')
  const [novoStatus, setNovoStatus] = useState<'Pendente' | 'Inspecionada' | 'Não é mês de inspeção'>('Pendente')
  const [isSubmittingNova, setIsSubmittingNova] = useState(false)

  // Delete modal state
  const [cintaToDelete, setCintaToDelete] = useState<{ id: string; tag: string } | null>(null)

  useEffect(() => {
    fetchCintas()
    const handleEnv = () => fetchCintas()
    window.addEventListener('sucena_environment_change', handleEnv)
    window.addEventListener('storage', handleEnv)
    return () => {
      window.removeEventListener('sucena_environment_change', handleEnv)
      window.removeEventListener('storage', handleEnv)
    }
  }, [fetchCintas])

  const mesAtualInfo = getMesInspecaoAtual()
  const [mesFiltro, setMesFiltro] = useState(mesAtualInfo.label)
  const [corFiltro, setCorFiltro] = useState('Todas')

  // Pagination state
  const [historyPage, setHistoryPage] = useState(1)
  const itemsPerPage = 5

  // Form state
  const [dataInspecao, setDataInspecao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCriarCinta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaTag.trim()) {
      toast.error('Informe a tag da cinta (ex: E-CIV-001).')
      return
    }
    if (!novaDescricao.trim()) {
      toast.error('Informe a descrição da cinta (ex: CINTA 4T - 4M).')
      return
    }

    setIsSubmittingNova(true)
    try {
      await adicionarCinta({
        tag: novaTag,
        descricao: novaDescricao,
        cor: novaCor,
        status: novoStatus,
      })
      toast.success(`Cinta ${novaTag.trim().toUpperCase()} adicionada com sucesso!`)
      setIsNovaCintaOpen(false)
      setNovaTag('')
      setNovaDescricao('')
      setNovoStatus('Pendente')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao adicionar cinta.')
    } finally {
      setIsSubmittingNova(false)
    }
  }

  const handleConfirmarExclusao = async () => {
    if (!cintaToDelete) return
    try {
      await removerCinta(cintaToDelete.id)
      toast.success(`Cinta ${cintaToDelete.tag} excluída com sucesso!`)
      setCintaToDelete(null)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir cinta.')
    }
  }

  const handleEdit = (cinta: any) => {
    setEditingCinta(cinta)
    setDataInspecao(
      cinta.inspecionadaEm
        ? cinta.inspecionadaEm.split('/').reverse().join('-')
        : new Date().toISOString().split('T')[0]
    )
    setObservacoes('')
    // Carrega fotos existentes: se houver array JSON ou string única
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

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 1200
          let width = img.width
          let height = img.height

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = (err) => reject(err)
      }
      reader.onerror = (err) => reject(err)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const toastId = toast.loading('Processando foto...')
    try {
      const newUrls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i])
        newUrls.push(compressed)
      }
      setFotos((prev) => [...prev, ...newUrls])
      toast.success(newUrls.length > 1 ? 'Fotos adicionadas!' : 'Foto adicionada!', { id: toastId })
    } catch (err) {
      console.error('Erro ao carregar foto:', err)
      toast.error('Erro ao carregar imagem', { id: toastId })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveFoto = (indexToRemove: number) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSave = async (novoStatus: 'Inspecionada' | 'Não é mês de inspeção') => {
    if (!editingCinta) return
    try {
      const fotoPayload = fotos.length === 0 ? null : (fotos.length === 1 ? fotos[0] : JSON.stringify(fotos))
      await inspecionarCinta(editingCinta.id, dataInspecao, observacoes, novoStatus, fotoPayload)
      setEditingCinta(null)
      setFotos([])
      setHistoryPage(1)
      toast.success('Inspeção registrada com sucesso!')
    } catch (e) {
      console.error('Erro ao salvar inspeção:', e)
      toast.error('Erro ao salvar inspeção')
    }
  }

  // Derived state
  const corDoMes = mesesInspecao.find((m) => m.label.toLowerCase() === mesFiltro.toLowerCase())?.cor || mesAtualInfo.cor
  const activeColorConfig = colorConfigs[corDoMes as CorCinta]
  const cintasMesAtivo = cintas.filter((c) => c.cor === corDoMes)
  const pendentesCount = cintasMesAtivo.filter(
    (c) => c.status !== 'Inspecionada'
  ).length
  const semFotoCount = cintasMesAtivo.filter(
    (c) => c.status === 'Inspecionada' && !c.foto
  ).length

  const filteredCintas = cintas.filter((c) => {
    if (corFiltro !== 'Todas' && c.cor !== corFiltro) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(historico.length / itemsPerPage))
  const currentHistory = historico.slice(
    (historyPage - 1) * itemsPerPage,
    historyPage * itemsPerPage
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white dark:bg-zinc-900/50 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
            <Link2 className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1c1d21] dark:text-white tracking-tight">
              Vistoria de Cintas
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Controle de inspeção mensal por cor
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsNovaCintaOpen(true)}
          variant="outline"
          className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-[#1c1d21] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 rounded-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Cinta
        </Button>
      </div>

      {/* ===== ALERTA DE INSPEÇÃO MENSAL ===== */}
      <AlertaInspecaoMensal />

      {/* Top Status Card */}
      <div className="p-5 rounded-2xl bg-[#333333] dark:bg-[#141414]/80 border border-transparent dark:border-white/5 shadow-sm relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        ></div>

        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center space-x-4">
            <div className={`w-7 h-7 rounded-full ${colorMap[corDoMes]} shadow-sm ring-4 ring-white/10 shrink-0`}></div>
            <div>
              <h2 className="text-lg font-medium text-[#1c1d21] dark:text-white">
                Mês de Inspeção:{' '}
                {mesFiltro.charAt(0).toUpperCase() + mesFiltro.slice(1)}
              </h2>
              <p className="text-sm text-[#5f6472] dark:text-gray-300 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                <span>Cor proibida / Inspeção do mês:</span>
                <span
                  className="font-bold px-2 py-0.5 rounded text-white inline-flex items-center gap-1 text-xs shadow-xs"
                  style={{ backgroundColor: activeColorConfig?.accentHex || '#3b82f6' }}
                >
                  {corDoMes}
                </span>
                <span>— Inspeção obrigatória das cintas desta cor</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {semFotoCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/20 text-amber-200 border-amber-500/30 rounded-full px-3 py-1 text-xs font-medium"
              >
                {semFotoCount} sem foto
              </Badge>
            )}
            <Badge
              variant="outline"
              className="bg-black/30 dark:bg-black/50 text-[#5f6472] dark:text-gray-200 dark:text-gray-300 border-white/20 dark:border-white/10 rounded-full px-4 py-1 font-normal"
            >
              {pendentesCount} pendente(s)
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-4 items-center">
          <div className="flex items-center space-x-2 bg-gray-400 dark:bg-black/40 dark:border dark:border-white/5 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-[#1c1d21] dark:text-white dark:text-gray-400" />
            <span className="text-sm text-[#1c1d21] dark:text-white dark:text-gray-400">Mês:</span>
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="bg-transparent text-sm text-[#1c1d21] dark:text-white dark:text-gray-400 outline-none border-none cursor-pointer"
            >
              {mesesInspecao.map((m) => (
                <option
                  key={m.label}
                  value={m.label}
                  className="text-gray-900 dark:text-gray-100"
                >
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-gray-400 dark:bg-black/40 dark:border dark:border-white/5 rounded-xl px-3 py-2 shadow-sm">
            <Filter className="w-4 h-4 text-[#1c1d21] dark:text-white dark:text-gray-400" />
            <span className="text-sm text-[#1c1d21] dark:text-white dark:text-gray-400">Cor:</span>
            <select
              value={corFiltro}
              onChange={(e) => setCorFiltro(e.target.value)}
              className="bg-transparent text-sm text-[#1c1d21] dark:text-white dark:text-gray-400 outline-none border-none cursor-pointer"
            >
              <option value="Todas" className="text-gray-900 dark:text-gray-100">
                Todas
              </option>
              <option value="Vermelho" className="text-gray-900 dark:text-gray-100">
                Vermelho
              </option>
              <option value="Azul" className="text-gray-900 dark:text-gray-100">
                Azul
              </option>
              <option value="Amarelo" className="text-gray-900 dark:text-gray-100">
                Amarelo
              </option>
              <option value="Verde" className="text-gray-900 dark:text-gray-100">
                Verde
              </option>
            </select>
          </div>
        </div>

        <Button
          variant="outline"
          className="bg-gray-400 dark:bg-black/40 border-transparent dark:border-white/5 hover:bg-gray-500 dark:hover:bg-white/10 text-[#1c1d21] dark:text-white rounded-xl shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-300 dark:text-green-500" />
          Exportar Excel
        </Button>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#0f0f0f] shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-white/5">
          <h3 className="text-lg font-medium text-[#1c1d21] dark:text-white">
            Equipamentos Cadastrados
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Cor</th>
                <th className="px-6 py-4 font-medium">Tag</th>
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Inspecionada em</th>
                <th className="px-6 py-4 font-medium">Foto</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
              {filteredCintas.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {cintas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Link2 className="w-8 h-8 text-gray-400 mb-1" />
                        <p className="font-semibold text-gray-800 dark:text-gray-200">Nenhuma cinta cadastrada neste ambiente</p>
                        <p className="text-xs text-gray-500">As cintas deste ambiente são adicionadas manualmente. Clique no botão abaixo para começar.</p>
                        <Button
                          onClick={() => setIsNovaCintaOpen(true)}
                          size="sm"
                          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Cadastrar Primeira Cinta
                        </Button>
                      </div>
                    ) : (
                      'Nenhuma cinta encontrada para os filtros selecionados.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredCintas.map((cinta) => {
                  const isCorDoMes = cinta.cor === corDoMes
                  const rowConfig = colorConfigs[cinta.cor as CorCinta]
                  const bgRowClass = isCorDoMes
                    ? `${rowConfig?.bgLight || 'bg-blue-50/70'} ${rowConfig?.bgDark || 'dark:bg-blue-950/25'} border-l-4 ${rowConfig?.borderClass || 'border-l-blue-500'}`
                    : 'bg-transparent'
                  const isPendente = cinta.status === 'Pendente'

                  return (
                    <tr
                      key={cinta.id}
                      className={`hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors ${bgRowClass}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full ${colorMap[cinta.cor]} shrink-0`}
                          ></div>
                          {isCorDoMes && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs"
                              style={{
                                backgroundColor: `${rowConfig?.accentHex}20`,
                                color: rowConfig?.accentHex,
                              }}
                            >
                              COR DO MÊS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-200 font-mono text-xs font-semibold">
                        {cinta.tag}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-300">
                        {cinta.descricao}
                      </td>
                      <td className="px-6 py-4">
                        {cinta.status === 'Inspecionada' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30">
                            {cinta.status}
                          </span>
                        ) : isPendente ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                            Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-transparent border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                            {cinta.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {cinta.inspecionadaEm || '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {cinta.foto ? (() => {
                          let firstImg = cinta.foto
                          let count = 1
                          try {
                            const p = JSON.parse(cinta.foto)
                            if (Array.isArray(p) && p.length > 0) {
                              firstImg = p[0]
                              count = p.length
                            }
                          } catch {}
                          return (
                            <div className="flex items-center gap-2">
                              <img
                                src={firstImg}
                                alt="Foto cinta"
                                onClick={() => setExpandedImage(firstImg)}
                                className="w-9 h-9 rounded-lg object-cover cursor-pointer border border-gray-200 dark:border-white/10 hover:scale-105 transition-transform shadow-xs"
                                title="Clique para expandir"
                              />
                              {count > 1 && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                  +{count - 1}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEdit(cinta)}
                                className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-1 transition-colors"
                                title="Gerenciar fotos"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        })() : (
                          <button
                            type="button"
                            onClick={() => handleEdit(cinta)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30 border border-blue-200 dark:border-blue-500/30 transition-all shadow-2xs"
                            title="Clique para adicionar foto da cinta"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Adicionar foto
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isCorDoMes ? (
                            <Button
                              size="sm"
                              onClick={() => handleEdit(cinta)}
                              className="h-8 px-3 text-xs font-semibold rounded-lg shadow-xs transition-transform active:scale-95 text-white"
                              style={{
                                backgroundColor: rowConfig?.accentHex || '#3b82f6',
                              }}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              {cinta.status === 'Inspecionada' ? 'Editar / Foto' : 'Inspecionar'}
                            </Button>
                          ) : (
                            <button
                              onClick={() => handleEdit(cinta)}
                              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors inline-flex items-center justify-end space-x-1 text-xs px-2 py-1"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCintaToDelete({ id: cinta.id, tag: cinta.tag })}
                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Excluir cinta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend / Calendar */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#141414] shadow-sm p-6">
        <h3 className="text-lg font-medium text-[#1c1d21] dark:text-white mb-6">
          Calendário de Inspeções por Cor
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { cor: 'Vermelho', meses: 'Jan, Mai, Set', cls: 'bg-red-500' },
            { cor: 'Azul', meses: 'Fev, Jun, Out', cls: 'bg-blue-500' },
            { cor: 'Amarelo', meses: 'Mar, Jul, Nov', cls: 'bg-yellow-500' },
            { cor: 'Verde', meses: 'Abr, Ago, Dez', cls: 'bg-green-500' },
          ].map((item) => (
            <div
              key={item.cor}
              className="flex items-center space-x-4 bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/5"
            >
              <div className={`w-5 h-5 rounded-full ${item.cls} shrink-0`}></div>
              <div>
                <p className="text-[#1c1d21] dark:text-white font-medium">{item.cor}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.meses}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111111] shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-white/5 flex items-center space-x-2">
          <History className="w-5 h-5 text-[#1c1d21] dark:text-white" />
          <h3 className="text-lg font-bold font-serif tracking-tight text-[#1c1d21] dark:text-white">
            Histórico de Vistoria de Cintas
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-transparent text-gray-600 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-4">Cor</th>
                <th className="px-6 py-4">Tag</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Inspecionada em</th>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4">Observações</th>
                <th className="px-6 py-4">Foto</th>
                <th className="px-6 py-4 text-center">Auditoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
              {currentHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Nenhum histórico encontrado.
                  </td>
                </tr>
              ) : (
                currentHistory.map((h) => (
                  <tr
                    key={h.id}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-3 h-3 rounded-full ${colorMap[h.cor]}`}
                        ></div>
                        <span className="text-gray-900 dark:text-gray-400">{h.cor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-mono text-xs">
                      {h.tag}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-medium">
                      {h.descricao}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          h.status === 'Inspecionada'
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{h.data}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {h.inspetor}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                      {h.observacoes || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {h.foto ? (() => {
                        let firstImg = h.foto
                        let count = 1
                        try {
                          const p = JSON.parse(h.foto)
                          if (Array.isArray(p) && p.length > 0) {
                            firstImg = p[0]
                            count = p.length
                          }
                        } catch {}
                        return (
                          <div className="flex items-center gap-2">
                            <img
                              src={firstImg}
                              alt="Foto histórico"
                              onClick={() => setExpandedImage(firstImg)}
                              className="w-9 h-9 rounded-lg object-cover cursor-pointer border border-gray-200 dark:border-white/10 hover:scale-105 transition-transform shadow-xs"
                              title="Clique para expandir"
                            />
                            {count > 1 && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                +{count - 1}
                              </span>
                            )}
                          </div>
                        )
                      })() : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-[#5f6472] dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <ClipboardList className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-[#111111]">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Mostrando {(historyPage - 1) * itemsPerPage + 1}-
            {Math.min(historyPage * itemsPerPage, historico.length)} de{' '}
            {historico.length}
          </span>

          <div className="flex space-x-1">
            <button
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setHistoryPage(i + 1)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${
                  historyPage === i + 1
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent dark:border-white/10'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
              disabled={historyPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog
        open={!!editingCinta}
        onOpenChange={(open) => !open && setEditingCinta(null)}
      >
        <DialogContent className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-serif tracking-tight text-[#1c1d21] dark:text-white">
              Registrar Inspeção
            </DialogTitle>
          </DialogHeader>

          {editingCinta && (
            <div className="space-y-6 pt-4">
              {/* Cinta info card */}
              <div className="flex justify-between items-center bg-gray-50 dark:bg-[#171717] rounded-xl p-4 border border-gray-100 dark:border-white/5">
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-6 h-6 rounded-full ${colorMap[editingCinta.cor]}`}
                  ></div>
                  <div>
                    <h4 className="font-medium text-[#1c1d21] dark:text-white font-mono text-sm">
                      {editingCinta.tag}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {editingCinta.descricao}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-gray-200 dark:border-white/20 text-gray-700 dark:text-gray-300 font-normal"
                >
                  {editingCinta.cor}
                </Badge>
              </div>

              {/* Data da Inspeção */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">
                  Data da Inspeção
                </Label>
                <DateInput
                  value={dataInspecao}
                  onChange={setDataInspecao}
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-[#1c1d21] dark:text-white focus-visible:ring-gray-300 dark:focus-visible:ring-white/20"
                />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">
                  Observações da Vistoria
                </Label>
                <Textarea
                  placeholder="Descreva os achados durante a inspeção, condição da cinta, etc..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10 text-[#1c1d21] dark:text-white resize-none h-24 focus-visible:ring-gray-300 dark:focus-visible:ring-white/20"
                />
              </div>

              {/* Foto da Cinta */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">
                    Foto da Cinta {fotos.length > 0 && `(${fotos.length})`}
                  </Label>
                  {fotos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar mais
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Galeria de Fotos Adicionadas */}
                {fotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {fotos.map((foto, index) => (
                      <div
                        key={index}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5 shadow-xs"
                      >
                        <img
                          src={foto}
                          alt={`Foto cinta ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                          onClick={() => setExpandedImage(foto)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedImage(foto)
                            }}
                            className="p-1.5 rounded-full bg-white/90 text-gray-900 hover:bg-white transition-transform hover:scale-110 pointer-events-auto"
                            title="Expandir foto"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFoto(index)
                            }}
                            className="p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-transform hover:scale-110 pointer-events-auto"
                            title="Remover foto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Botão de adicionar mais fotos na própria grade */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center text-gray-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
                    >
                      <Plus className="w-6 h-6 mb-1" />
                      <span className="text-xs font-semibold">Adicionar</span>
                    </button>
                  </div>
                ) : (
                  /* Área vazia para adicionar primeira foto */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-gray-300 dark:border-white/20 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 dark:hover:bg-white/5 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all mb-2">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-emerald-600 transition-colors">
                      Clique para adicionar foto da cinta
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">
                      PNG, JPG ou foto direta da câmera
                    </span>
                  </div>
                )}
              </div>

              {/* Status Actions */}
              <div className="space-y-3 pt-2">
                <Label className="text-sm font-medium text-[#1c1d21] dark:text-white">
                  Status
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleSave('Inspecionada')}
                    className="w-full bg-[#10b981] hover:bg-[#059669] text-white border-none rounded-xl"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar como Inspecionada
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSave('Não é mês de inspeção')}
                    className="w-full bg-white dark:bg-transparent border-gray-200 dark:border-white/10 text-[#1c1d21] dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar como Cancelada
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Cadastrar Nova Cinta */}
      <Dialog open={isNovaCintaOpen} onOpenChange={setIsNovaCintaOpen}>
        <DialogContent className="bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              Cadastrar Nova Cinta
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriarCinta} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Tag de Identificação *
              </Label>
              <Input
                placeholder="Ex: E-CIV-001 ou CINTA-01"
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                className="mt-1 font-mono uppercase bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-xl"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Descrição do Equipamento *
              </Label>
              <Input
                placeholder="Ex: CINTA 4T - 4M ou CINTA 2T - 6M"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                className="mt-1 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-xl"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                Cor de Inspeção da Cinta *
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Vermelho', 'Azul', 'Amarelo', 'Verde'] as const).map((cor) => {
                  const isSelected = novaCor === cor
                  return (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setNovaCor(cor)}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30 text-gray-900 dark:text-white'
                          : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${colorMap[cor]}`} />
                      <span>{cor}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                Status Inicial
              </Label>
              <select
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value as any)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none cursor-pointer"
              >
                <option value="Pendente" className="text-gray-900 dark:text-gray-100">
                  Pendente de Inspeção
                </option>
                <option value="Inspecionada" className="text-gray-900 dark:text-gray-100">
                  Inspecionada
                </option>
                <option value="Não é mês de inspeção" className="text-gray-900 dark:text-gray-100">
                  Não é mês de inspeção
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNovaCintaOpen(false)}
                className="rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingNova}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                {isSubmittingNova ? 'Salvando...' : 'Adicionar Cinta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Exclusão de Cinta */}
      <Dialog open={!!cintaToDelete} onOpenChange={(open) => !open && setCintaToDelete(null)}>
        <DialogContent className="bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Excluir Cinta
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600 dark:text-gray-300 py-2">
            Tem certeza que deseja excluir a cinta <strong className="font-mono text-gray-900 dark:text-white">{cintaToDelete?.tag}</strong> deste ambiente? O histórico vinculado a ela também será removido.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCintaToDelete(null)}
              className="rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs"
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal de Expansão de Foto (Lightbox) */}
      {expandedImage && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in cursor-zoom-out"
          style={{ zIndex: 9999999 }}
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center cursor-default" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExpandedImage(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={expandedImage}
              alt="Foto ampliada da cinta"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
