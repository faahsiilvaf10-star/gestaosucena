import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { FileText, Clock, AlertTriangle, Search, Filter, History, Edit, Plus, X, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, differenceInDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateInput } from '@/components/ui/DateInput'

export const Route = createFileRoute('/permissao-trabalho/')({
  component: PermissaoTrabalhoPage,
})

interface PermissaoTrabalho {
  id: string
  titulo: string
  numero: string
  tipo: string
  data_vencimento: string
  status: string
  arquivo_url: string | null
  created_at: string
}

function PermissaoTrabalhoPage() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<'pt' | 'sem_pt'>('pt')
  const [pts, setPts] = useState<PermissaoTrabalho[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('Todos os tipos')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Formulário
  const [titulo, setTitulo] = useState('')
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState('PT (Permissão de Trabalho)')
  const [dataVencimento, setDataVencimento] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const fetchPTs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('permissao_trabalho')
      .select('*')
      .order('data_vencimento', { ascending: true })

    if (error) {
      console.error('Erro ao buscar PTs:', error)
    } else if (data) {
      setPts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPTs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo || !numero || !dataVencimento) return

    setUploading(true)
    let arquivo_url = null

    try {
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('permissao_trabalho_anexos')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('permissao_trabalho_anexos')
          .getPublicUrl(filePath)
          
        arquivo_url = publicUrl
      }

      const { error } = await supabase.from('permissao_trabalho').insert([
        {
          titulo,
          numero,
          tipo,
          data_vencimento: dataVencimento,
          arquivo_url,
          status: 'Atualizado'
        }
      ])

      if (error) throw error

      setIsModalOpen(false)
      setTitulo('')
      setNumero('')
      setDataVencimento('')
      setFile(null)
      fetchPTs()
    } catch (err) {
      console.error('Erro ao salvar PT:', err)
      alert('Erro ao salvar Permissão de Trabalho.')
    } finally {
      setUploading(false)
    }
  }

  // Cálculos de Status Dinâmico
  const getStatusInfo = (data_vencimento: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const vencDate = parseISO(data_vencimento)
    vencDate.setHours(0, 0, 0, 0)
    
    const diff = differenceInDays(vencDate, today)

    if (diff < 0) {
      return { label: 'Vencido', color: 'bg-red-500/10 text-red-500', icon: <AlertTriangle size={14} /> }
    } else if (diff <= 5) {
      return { label: 'A Vencer', color: 'bg-orange-500/10 text-orange-500', icon: <Clock size={14} /> }
    } else {
      return { label: 'Atualizado', color: 'bg-green-500/20 text-green-500', icon: <span className="text-[10px]">✔</span> }
    }
  }

  const pendentesCount = pts.filter(pt => {
    const st = getStatusInfo(pt.data_vencimento).label
    return st === 'Atualizado' // Or define exactly what "Pendente" means if it's different. In the mockup it's 0 for all, I'll assume pendente might be pending signature or just total. Let's make it Total for now.
  }).length

  const aVencerCount = pts.filter(pt => getStatusInfo(pt.data_vencimento).label === 'A Vencer').length
  const vencidosCount = pts.filter(pt => getStatusInfo(pt.data_vencimento).label === 'Vencido').length

  const filteredPts = pts.filter(pt => {
    const matchesSearch = pt.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || pt.numero.includes(searchTerm)
    const matchesType = filterType === 'Todos os tipos' || pt.tipo === filterType
    const matchesStatus = filterStatus === 'Todos' || getStatusInfo(pt.data_vencimento).label === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-20 ${isDark ? 'text-white' : 'text-gray-900'}`}>
      
      {/* Header Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('pt')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'pt' ? 'bg-white/10 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Permissão de Trabalho
        </button>
        <button
          onClick={() => setActiveTab('sem_pt')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'sem_pt' ? 'bg-white/10 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Atividades sem PT
        </button>
        
        <div className="flex-1" />
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full text-sm transition-colors shadow-sm"
        >
          <Plus size={16} /> Nova PT
        </button>
      </div>

      {activeTab === 'pt' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="dashboard-card relative overflow-hidden p-6 flex items-center gap-4 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                <FileText className="text-yellow-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{pts.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total / Pendentes</div>
              </div>
            </div>

            <div className="dashboard-card relative overflow-hidden p-6 flex items-center gap-4 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <Clock className="text-orange-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{aVencerCount}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">A vencer</div>
              </div>
            </div>

            <div className="dashboard-card relative overflow-hidden p-6 flex items-center gap-4 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{vencidosCount}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Vencidos</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por título ou descrição..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>
            
            <div className="flex gap-2">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none cursor-pointer"
              >
                <option>Todos os tipos</option>
                <option>PT (Permissão de Trabalho)</option>
                <option>Permissão de Trabalho em Altura</option>
                <option>Análise de Risco</option>
                <option>EBTV</option>
                <option>PRO</option>
              </select>
              
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none cursor-pointer"
              >
                <option>Todos</option>
                <option>Atualizado</option>
                <option>A Vencer</option>
                <option>Vencido</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm p-6">
            <h2 className="text-xl font-bold mb-6 font-serif">Lista de Documentos</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/5 text-sm text-gray-500 dark:text-gray-400">
                    <th className="pb-3 font-semibold pl-4">Título</th>
                    <th className="pb-3 font-semibold">Tipo</th>
                    <th className="pb-3 font-semibold">Vencimento</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right pr-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">Carregando permissões...</td>
                    </tr>
                  ) : filteredPts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">Nenhuma Permissão de Trabalho encontrada.</td>
                    </tr>
                  ) : (
                    filteredPts.map(pt => {
                      const statusInfo = getStatusInfo(pt.data_vencimento)
                      
                      return (
                        <tr key={pt.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="py-4 pl-4">
                            <div className="font-bold text-sm text-gray-900 dark:text-white">{pt.titulo}</div>
                            <div className="text-xs text-gray-500">Numero: {pt.numero}</div>
                          </td>
                          <td className="py-4">
                            <span className="inline-flex px-3 py-1 rounded-full border border-gray-200 dark:border-white/20 text-xs font-medium bg-transparent">
                              {pt.tipo}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-gray-700 dark:text-gray-300">
                            {format(parseISO(pt.data_vencimento), 'dd/MM/yyyy')}
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.icon}
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              {pt.arquivo_url && (
                                <a href={pt.arquivo_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors" title="Ver Anexo">
                                  <FileText size={16} />
                                </a>
                              )}
                              <button className="text-gray-400 hover:text-white transition-colors">
                                <History size={16} />
                              </button>
                              <button className="text-gray-400 hover:text-white transition-colors">
                                <Edit size={16} />
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
        </>
      )}

      {activeTab === 'sem_pt' && (
        <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl bg-white shadow-lg border border-gray-200 rounded-sm overflow-hidden" style={{ aspectRatio: '1 / 1.414' }}>
            <img 
              src="/documentos/lista-atividades-sem-pt.png" 
              alt="Lista de Atividades que NÃO requerem Permissão de Trabalho" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Nova Permissão</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Título / Atividade</label>
                <input 
                  required
                  type="text" 
                  value={titulo}
                  onChange={e => setTitulo(e.target.value.toUpperCase())}
                  placeholder="Ex: IÇAMENTO DE CARGAS"
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Número</label>
                  <input 
                    required
                    type="text" 
                    value={numero}
                    onChange={e => setNumero(e.target.value)}
                    placeholder="Ex: 021468"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Vencimento</label>
                  <DateInput
                    required
                    value={dataVencimento}
                    onChange={setDataVencimento}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                <select 
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option>PT (Permissão de Trabalho)</option>
                  <option>Permissão de Trabalho em Altura</option>
                  <option>Análise de Risco</option>
                  <option>EBTV</option>
                  <option>PRO</option>
                  <option>Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Anexo (PDF ou Imagem)</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-white/20 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                     onClick={() => document.getElementById('pt-file')?.click()}>
                  <Upload size={24} className="text-gray-400 mb-2" />
                  <span className="text-xs text-gray-500">{file ? file.name : 'Clique para anexar arquivo'}</span>
                  <input 
                    id="pt-file"
                    type="file" 
                    className="hidden" 
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {uploading ? 'Salvando...' : 'Salvar Permissão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
