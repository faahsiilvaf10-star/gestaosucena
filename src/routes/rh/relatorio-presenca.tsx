import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { FileText, Calendar, CheckCircle2, XCircle, Users, Activity } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'

export const Route = createFileRoute('/rh/relatorio-presenca')({
  component: RelatorioPresencaPage,
})

type Presenca = {
  id: string
  funcionario_id: string
  area: string
  status: string
  nome: string
  cargo: string | null
}

function RelatorioPresencaPage() {
  const { isDark } = useTheme()
  const getLocalDate = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  const [date, setDate] = useState<string>(getLocalDate())
  const [registros, setRegistros] = useState<Presenca[]>([])
  const [loading, setLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  const [totalEfetivo, setTotalEfetivo] = useState(0)

  useEffect(() => {
    fetchRelatorio()
  }, [date])

  const fetchRelatorio = async () => {
    setLoading(true)
    try {
      // 1. Fetch efetivo to get names, cargos, and total count
      const { data: efetivo, error: efetivoError } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo')
        
      if (efetivoError) throw efetivoError

      setTotalEfetivo(efetivo.length)
      const efetivoMap = new Map(efetivo.map(e => [e.id, { nome: e.nome, cargo: e.cargo }]))

      // 2. Fetch presenças for date
      const { data: presencas, error: presencasError } = await supabase
        .from('rh_presencas')
        .select('*')
        .eq('data', date)
        
      if (presencasError) throw presencasError

      if (!presencas || presencas.length === 0) {
        setRegistros([])
        setHasData(false)
        setLoading(false)
        return
      }

      // 3. Merge and filter out REMOVIDO and only allow specified statuses
      const allowedStatuses = ['PRESENTE', 'AUSENTE', 'EXTERNO', 'ATESTADO']
      const merged: Presenca[] = presencas
        .filter(p => p.status !== 'REMOVIDO' && allowedStatuses.includes(p.status))
        .map(p => {
          const emp = efetivoMap.get(p.funcionario_id)
          let area = p.area
          if (!area || area.toUpperCase().includes('BARCARENA')) area = 'Área Gabião'
          return {
            id: p.id,
            funcionario_id: p.funcionario_id,
            area,
            status: p.status,
            nome: emp ? emp.nome : 'Desconhecido',
            cargo: emp ? emp.cargo : null
          }
        })
        
      // Order alphabetically by Nome
      merged.sort((a, b) => a.nome.localeCompare(b.nome))

      setRegistros(merged)
      setHasData(merged.length > 0)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePDF = () => {
    if (registros.length === 0) {
      toast.error('Nenhum dado para gerar o PDF.')
      return
    }

    const generate = (logoImg?: HTMLImageElement) => {
      const doc = new jsPDF()
      
      if (logoImg) {
        doc.addImage(logoImg, 'PNG', 165, 10, 30, 15)
      }
      
      doc.setFontSize(16)
      doc.text('Relatório de Presença - Sucena', 14, 18)
      
      doc.setFontSize(10)
      const dataFormatada = date.split('-').reverse().join('/')
      doc.text(`Data: ${dataFormatada}`, 14, 25)
      
      const tableData = registros.map(c => [
        c.nome,
        c.cargo || '-',
        c.area || 'Sem Área',
        c.status
      ])
      
      autoTable(doc, {
        startY: 32,
        head: [['Nome', 'Cargo', 'Área', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 40], fontSize: 9 },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      })
      
      doc.save(`Relatorio_Presenca_${date}.pdf`)
      toast.success('PDF gerado com sucesso!')
    }

    const img = new Image()
    img.src = '/logo-relatorio.png'
    img.onload = () => generate(img)
    img.onerror = () => generate()
  }

  const presentes = registros.filter(r => r.status === 'PRESENTE').length
  const ausentes = registros.filter(r => r.status === 'AUSENTE').length
  const atestados = registros.filter(r => r.status === 'ATESTADO').length
  const externos = registros.filter(r => r.status === 'EXTERNO').length

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PRESENTE': return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'AUSENTE': return 'bg-red-500/20 text-red-500 border-red-500/30'
      case 'ATESTADO': return 'bg-purple-500/20 text-purple-500 border-purple-500/30'
      case 'EXTERNO': return 'bg-amber-500/20 text-amber-500 border-amber-500/30'
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30'
    }
  }

  return (
    <div className={`flex flex-col h-full min-h-screen ${isDark ? 'bg-[#111111] text-white' : 'bg-[#faf9f6] text-gray-900'} p-4 md:p-8`}>
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display italic tracking-tight flex items-center gap-3">
              <Calendar className="text-[#0866ff]" size={28} />
              Relatório Diário de Presença
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Visualize e exporte os status de presença consolidados.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:border-[#0866ff] transition-colors"
            />
            <button 
              onClick={handleGeneratePDF}
              disabled={!hasData}
              className="px-5 py-2.5 rounded-xl font-semibold bg-[#0866ff] hover:bg-[#0866ff]/90 text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={18} /> Gerar PDF
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-white/50 text-xs font-medium uppercase tracking-wider mb-1">Total</p>
              <p className="text-2xl font-bold">{totalEfetivo}</p>
            </div>
            <Users className="text-gray-400 dark:text-white/20" size={28} />
          </div>
          
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-green-700 dark:text-green-400 text-xs font-medium uppercase tracking-wider mb-1">Presentes</p>
              <p className="text-green-600 dark:text-green-500 text-2xl font-bold">{presentes}</p>
            </div>
            <CheckCircle2 className="text-green-500/50" size={28} />
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-red-700 dark:text-red-400 text-xs font-medium uppercase tracking-wider mb-1">Ausentes</p>
              <p className="text-red-600 dark:text-red-500 text-2xl font-bold">{ausentes}</p>
            </div>
            <XCircle className="text-red-500/50" size={28} />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-amber-700 dark:text-amber-400 text-xs font-medium uppercase tracking-wider mb-1">Externo</p>
              <p className="text-amber-600 dark:text-amber-500 text-2xl font-bold">{externos}</p>
            </div>
            <Activity className="text-amber-500/50" size={28} />
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-purple-700 dark:text-purple-400 text-xs font-medium uppercase tracking-wider mb-1">Atestado</p>
              <p className="text-purple-600 dark:text-purple-500 text-2xl font-bold">{atestados}</p>
            </div>
            <Activity className="text-purple-500/50" size={28} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/5 rounded-3xl overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-white/50">
              Carregando relatório...
            </div>
          ) : !hasData ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-white/50 p-8">
              <Calendar size={48} className="mb-4 opacity-20" />
              <p className="text-lg">Nenhum registro de presença encontrado para {date.split('-').reverse().join('/')}</p>
              <p className="text-sm opacity-70 mt-2">Você precisa primeiro salvar a lista de presença desta data.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {registros.map((r, i) => (
                  <div key={`${r.id}-${i}`} className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-semibold">{r.nome}</div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold border whitespace-nowrap ${getStatusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/50 flex justify-between">
                      <span>{r.cargo || 'Sem Cargo'}</span>
                      <span>{r.area}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  )
}
