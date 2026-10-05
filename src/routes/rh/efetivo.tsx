import Users from 'lucide-react/dist/esm/icons/users.js';
import Upload from 'lucide-react/dist/esm/icons/upload.js';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Filter from 'lucide-react/dist/esm/icons/funnel.js';
import Pencil from 'lucide-react/dist/esm/icons/pencil.js';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { DateInput } from '../../components/ui/DateInput'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useTheme } from '../../contexts/ThemeContext'

export const Route = createFileRoute('/rh/efetivo')({
  component: RhEfetivoPage,
})

type EfetivoItem = {
  id: string
  nome: string
  cargo: string | null
  matricula: string | null
  matricula_hydro?: string | null
  matricula_sucena?: string | null
  data_admissao: string | null
  status: string
  setor: string | null
  aso_admissional?: string | null
  aso_admissional_2?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  observacao?: string | null
  validade_aso_efetiva?: string | null
  raw_data?: any
}

function RhEfetivoPage() {
  const { isDark } = useTheme()
  const [items, setItems] = useState<EfetivoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [selectedColaborador, setSelectedColaborador] = useState<EfetivoItem | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingAso, setIsEditingAso] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email || null
      setUserEmail(email)
      if (user) {
        // Tenta pegar o role do metadata primeiro (mais rápido)
        const metaRole = user.user_metadata?.role || ''
        
        // Também busca via RPC
        const { data: users } = await supabase.rpc('get_users')
        let rpcRole = ''
        if (users) {
          const currentUserProfile = (users as any[]).find((u: any) => u.id === user.id)
          rpcRole = currentUserProfile?.role || currentUserProfile?.cargo || ''
        }
        
        const finalRole = rpcRole || metaRole
        setUserRole(finalRole)
        
        const isAdmin = email === 'ffaahsiilva@gmail.com'
        const roleStr = finalRole.toLowerCase()
        const hasEditRole = (
          roleStr.includes('auxiliar administrativo') ||
          roleStr.includes('aux. administrativo') ||
          roleStr.includes('admin') ||
          roleStr.includes('diretor')
        )
        setCanEdit(isAdmin || hasEditRole)
      }
    }
    fetchUser()
    fetchEfetivo()
  }, [])

  const fetchEfetivo = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('*')
        .order('nome', { ascending: true })
      
      if (error) throw error
      
      setItems(data || [])
    } catch (err) {
      console.error('Error fetching efetivo:', err)
      toast.error('Erro ao buscar lista de efetivo')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMatricula = async (id: string, newMatricula: string) => {
    try {
      const { error } = await supabase
        .from('rh_efetivo')
        .update({ matricula: newMatricula || null })
        .eq('id', id)
      
      if (error) throw error
      
      setItems(prev => prev.map(item => item.id === id ? { ...item, matricula: newMatricula || null } : item))
      toast.success('Matrícula atualizada com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar matrícula')
    }
  }

  const handleUpdateField = async (id: string, field: string, value: string | null) => {
    try {
      const payload: any = { [field]: value || null }
      
      if (['aso_admissional', 'aso_periodico', 'retorno_ao_trabalho', 'mudanca_de_risco'].includes(field)) {
        const item = items.find(i => i.id === id)
        if (item) {
          const tempColab = { ...item, ...payload }
          const dates = [
            tempColab.aso_admissional,
            tempColab.aso_periodico,
            tempColab.retorno_ao_trabalho,
            tempColab.mudanca_de_risco
          ].filter(Boolean) as string[];
          // Postgres handles validade_aso_efetiva via GENERATED ALWAYS column.
        }
      }

      const { error } = await supabase
        .from('rh_efetivo')
        .update(payload)
        .eq('id', id)
      
      if (error) throw error
      
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item))
      setSelectedColaborador(prev => (prev && prev.id === id) ? { ...prev, ...payload } : prev)
      toast.success('Atualizado com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar informação')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const toastId = toast.loading('Lendo planilha de efetivo...')

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = event.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          let allRows: any[] = []

          // Read all sheets EXCEPT "DEMITIDOS - TRANSFERIDOS"
          workbook.SheetNames.forEach(sheetName => {
            if (sheetName.toUpperCase().trim() === 'DEMITIDOS - TRANSFERIDOS') {
              console.log('Ignorando aba:', sheetName)
              return
            }

            const sheet = workbook.Sheets[sheetName]
            // Leitura como array de arrays para encontrar a linha de cabeçalho verdadeira
            const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
            
            // Encontrar o índice da linha de cabeçalho (procura por COLABORADOR)
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(20, rawRows.length); i++) {
              if (rawRows[i] && rawRows[i].some(cell => typeof cell === 'string' && cell.toUpperCase().includes('COLABORADOR'))) {
                headerRowIndex = i;
                break;
              }
            }

            if (headerRowIndex !== -1) {
              const headers = rawRows[headerRowIndex].map(h => typeof h === 'string' ? h.trim().toUpperCase() : String(h || '').toUpperCase());
              
              // Processar as linhas abaixo do cabeçalho
              for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
                const row = rawRows[i];
                if (!row || row.length === 0 || !row.some(c => c)) continue; // Linha vazia
                
                const rowObj: any = {};
                headers.forEach((header, idx) => {
                  rowObj[header] = row[idx];
                });
                allRows.push(rowObj);
              }
            } else {
              // Fallback se não encontrar o cabeçalho
              const rows = XLSX.utils.sheet_to_json(sheet)
              allRows = [...allRows, ...rows]
            }
          })

          if (allRows.length === 0) {
            toast.error('Nenhum dado encontrado nas abas lidas', { id: toastId })
            setIsImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
          }

          toast.loading(`Processando ${allRows.length} registros...`, { id: toastId })

          // Map rows to our database schema
          const processedData = allRows.map((row: any) => {
            const getVal = (possibleKeys: string[]) => {
              const foundKey = Object.keys(row).find(k => possibleKeys.includes(k.trim().toUpperCase()))
              return foundKey ? row[foundKey] : null
            }

            const nome = getVal(['NOME', 'NOME COMPLETO', 'COLABORADOR', 'FUNCIONÁRIO']) || 'Sem Nome'
            const cargo = getVal(['CARGO', 'FUNÇÃO', 'FUNCAO'])
            const matricula = getVal(['MATRÍCULA', 'MATRICULA', 'RE'])
            const matriculaHydro = getVal(['MATRÍCULA HYDRO', 'MATRICULA HYDRO', 'HYDRO', 'MAT. HYDRO', 'MAT HYDRO'])
            const matriculaSucena = getVal(['MATRÍCULA SUCENA', 'MATRICULA SUCENA', 'SUCENA', 'MAT. SUCENA', 'MAT SUCENA'])
            const status = getVal(['STATUS', 'SITUAÇÃO', 'SITUACAO']) || 'ATIVO'
            const setor = getVal(['SETOR', 'DEPARTAMENTO', 'ÁREA', 'AREA', 'LOCALIDADE', 'LOCALIDADE '])
            
            // Format admission date if exists
            let asoAdmissional = getVal(['ASO ADMISSIONAL'])
            if (typeof asoAdmissional === 'number') {
              const d = new Date((asoAdmissional - (25567 + 2)) * 86400 * 1000)
              asoAdmissional = d.toISOString().split('T')[0]
            } else if (typeof asoAdmissional === 'string' && asoAdmissional.includes('/')) {
              const parts = asoAdmissional.split('/')
              if (parts.length === 3) asoAdmissional = `${parts[2]}-${parts[1]}-${parts[0]}`
            }

            let admissional = getVal(['DATA DE ADMISSÃO', 'ADMISSÃO', 'ADMISSAO', 'DATA ADMISSAO'])
            if (typeof admissional === 'number') {
              const d = new Date((admissional - (25567 + 2)) * 86400 * 1000)
              admissional = d.toISOString().split('T')[0]
            } else if (typeof admissional === 'string' && admissional.includes('/')) {
              const parts = admissional.split('/')
              if (parts.length === 3) admissional = `${parts[2]}-${parts[1]}-${parts[0]}`
            }

            // Force matricula to be null for Auxiliar Administrativo as requested
            let finalMatricula = matricula ? String(matricula) : null
            if (cargo && String(cargo).toUpperCase().includes('AUXILIAR ADMINISTRATIVO')) {
              finalMatricula = null
            }

            return {
              nome,
              cargo: cargo ? String(cargo) : null,
              matricula: finalMatricula,
              matricula_hydro: matriculaHydro ? String(matriculaHydro) : null,
              matricula_sucena: matriculaSucena ? String(matriculaSucena) : null,
              status: String(status),
              setor: setor ? String(setor) : null,
              aso_admissional_2: admissional ? String(admissional) : null,
              aso_admissional: asoAdmissional ? String(asoAdmissional) : null,
              raw_data: row
            }
          })

          // Prevent duplicates and retrieve existing matriculas
          const { data: existingData } = await supabase.from('rh_efetivo').select('id, nome, matricula, matricula_hydro, matricula_sucena')
          const existingMap = new Map<string, any>((existingData || []).map((d: any) => [d.nome.toUpperCase(), d]))

          const uniqueNewProcessedData: any[] = []
          const recordsToUpdate: any[] = []
          const allNamesInSheet = new Set<string>()

          processedData.forEach((d: any) => {
            const upperName = d.nome.toUpperCase()
            // Keep track of all names present in the spreadsheet
            allNamesInSheet.add(upperName)
            
            if (existingMap.has(upperName)) {
              const existingRec = existingMap.get(upperName)
              // If we haven't already processed this person in this file
              if (existingRec !== 'processed') {
                // Keep the database matricula so we don't wipe it!
                d.matricula = existingRec.matricula
                // Preserve existing matricula_hydro/sucena only if the sheet doesn't have them
                if (!d.matricula_hydro) d.matricula_hydro = existingRec.matricula_hydro
                if (!d.matricula_sucena) d.matricula_sucena = existingRec.matricula_sucena
                d.id = existingRec.id // Needed for update
                recordsToUpdate.push(d)
                
                // Mark as processed to prevent duplicates in the same file
                existingMap.set(upperName, 'processed')
              }
            } else {
              uniqueNewProcessedData.push(d)
              existingMap.set(upperName, 'processed')
            }
          })

          // Find IDs of employees that are in DB but NOT in the new spreadsheet
          const idsToDelete: string[] = []
          existingMap.forEach((rec: any, upperName: string) => {
            if (rec !== 'processed' && !allNamesInSheet.has(upperName)) {
              idsToDelete.push(rec.id)
            }
          })

          // Run database operations
          let successMessage = ''
          let totalUpdated = 0
          
          if (idsToDelete.length > 0) {
            const { error: delError } = await supabase.from('rh_efetivo').delete().in('id', idsToDelete)
            if (delError) throw delError
            successMessage += `${idsToDelete.length} removidos. `
          }

          if (uniqueNewProcessedData.length > 0) {
            const { error: insError } = await supabase.from('rh_efetivo').insert(uniqueNewProcessedData)
            if (insError) throw insError
            successMessage += `${uniqueNewProcessedData.length} novos. `
          }

          // Update existing records individually
          if (recordsToUpdate.length > 0) {
            // Processing updates in parallel chunks could be faster, but sequential is safer for small numbers
            for (const rec of recordsToUpdate) {
              const { id, ...updateData } = rec
              const { error: upError } = await supabase.from('rh_efetivo').update(updateData).eq('id', id)
              if (!upError) totalUpdated++
            }
            if (totalUpdated > 0) successMessage += `${totalUpdated} atualizados (mantendo matrícula).`
          }

          if (!successMessage) {
            successMessage = 'Planilha sincronizada. Nenhuma alteração foi necessária.'
          }

          const { logActivity } = await import('../../lib/logActivity');
          await logActivity({
            module: 'RH',
            action: `Planilha de Efetivo importada: ${successMessage.trim()}`
          });

          toast.success(successMessage.trim(), { id: toastId })
          fetchEfetivo()
        } catch (err: any) {
          console.error(err)
          toast.error(`Erro ao processar planilha: ${err.message}`, { id: toastId })
        } finally {
          setIsImporting(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }
      
      reader.onerror = () => {
        toast.error('Erro ao ler arquivo', { id: toastId })
        setIsImporting(false)
      }
      
      reader.readAsBinaryString(file)
    } catch (err) {
      console.error(err)
      toast.error('Erro inesperado', { id: toastId })
      setIsImporting(false)
    }
  }


  const handleDeleteColaborador = async (id: string) => {
    try {
      const { error } = await supabase.from('rh_efetivo').delete().eq('id', id)
      if (error) throw error
      setItems(prev => prev.filter(item => item.id !== id))
      setSelectedColaborador(null)
      setShowDeleteConfirm(false)
      toast.success('Colaborador removido com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao remover colaborador')
    }
  }

  const handleSaveAll = async () => {
    if (!selectedColaborador) return
    setIsSaving(true)
    try {
      const payload: any = {
        nome: selectedColaborador.nome,
        cargo: selectedColaborador.cargo,
        matricula: selectedColaborador.matricula,
        matricula_hydro: selectedColaborador.matricula_hydro,
        matricula_sucena: selectedColaborador.matricula_sucena,
        status: selectedColaborador.status,
        setor: selectedColaborador.setor,
        aso_admissional: selectedColaborador.aso_admissional,
        aso_admissional_2: selectedColaborador.aso_admissional_2,
        aso_periodico: selectedColaborador.aso_periodico,
        retorno_ao_trabalho: selectedColaborador.retorno_ao_trabalho,
        mudanca_de_risco: selectedColaborador.mudanca_de_risco,
        observacao: selectedColaborador.observacao
      }

      const dates = [
        payload.aso_admissional,
        payload.aso_periodico,
        payload.retorno_ao_trabalho,
        payload.mudanca_de_risco
      ].filter(Boolean) as string[];
      
      if (dates.length === 0) {
        // Do nothing, Postgres will generate it
      }

      const { error } = await supabase.from('rh_efetivo').update(payload).eq('id', selectedColaborador.id)
      if (error) throw error
      setItems(prev => prev.map(item => item.id === selectedColaborador.id ? { ...item, ...payload } : item))
      setHasUnsavedChanges(false)
      toast.success('Alterações salvas com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar alterações')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Efetivo ASO')
      
      let logoId: number | null = null
      try {
        const response = await fetch('/logo-relatorio.png')
        const arrayBuffer = await response.arrayBuffer()
        logoId = workbook.addImage({
          buffer: arrayBuffer,
          extension: 'png',
        })
      } catch (e) {
        console.warn('Could not load logo for export')
      }

      // Add empty rows for header space
      sheet.addRow([])
      sheet.addRow([])
      sheet.addRow([])
      sheet.addRow([])
      sheet.addRow([])

      if (logoId !== null) {
        sheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 180, height: 60 },
        })
      }

      // Add Headers
      const headerRow = sheet.addRow([
        'Matrícula', 'Nome', 'Cargo', 'Admissional', 'ASO Admissional', 
        'Periódico', 'Retorno ao Trabalho', 'Mudança de Risco', 'Validade ASO'
      ])
      
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' }
      }

      // Format date helper
      const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-'
        return dateStr.split('-').reverse().join('/')
      }

      // Calculate validades
      filteredItems.forEach(item => {
        let validade = '-'
        const dates = [
          item.aso_admissional, // Agora este é o ASO Admissional
          item.aso_periodico,
          item.retorno_ao_trabalho,
          item.mudanca_de_risco
        ].filter(Boolean) as string[]
        
        if (dates.length > 0) {
          const latestDate = dates.reduce((a, b) => (a > b ? a : b))
          const date = new Date(latestDate + 'T12:00:00') 
          date.setFullYear(date.getFullYear() + 1)
          validade = date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})
        }

        sheet.addRow([
          item.matricula || '-',
          item.nome || '-',
          item.cargo || '-',
          formatDate(item.aso_admissional_2), // Admissional (Hiring Date) is saved here
          formatDate(item.aso_admissional),   // ASO Admissional (Medical Exam) is saved here
          formatDate(item.aso_periodico),
          formatDate(item.retorno_ao_trabalho),
          formatDate(item.mudanca_de_risco),
          validade
        ])
      })

      sheet.columns.forEach((col, idx) => {
        col.width = idx === 1 ? 40 : 20 // Nome is wider
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `Controle_ASO_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`)
      toast.success('Relatório exportado com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao exportar planilha')
    } finally {
      setIsExporting(false)
    }
  }
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      item.nome.toLowerCase().includes(q) ||
      (item.cargo?.toLowerCase().includes(q)) ||
      (item.matricula?.toLowerCase().includes(q)) ||
      (item.matricula_hydro?.toLowerCase().includes(q))
    )
  })

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto flex-1">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/rh" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="tracking-tight" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>Efetivo</h1>
            </div>
            <p className="text-sm text-gray-500 ml-9">Gestão completa de colaboradores ativos da empresa.</p>
          </div>
          
          <div className="flex gap-2 items-center">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              {isImporting ? 'Lendo...' : 'Importar Planilha'}
            </button>
            <button 
              onClick={handleExportExcel}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <Download size={18} />
              {isExporting ? 'Baixando...' : 'Exportar ASO'}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1a1b] rounded-2xl border border-black/10 dark:border-white/10 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-700 mt-4">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-black/10 dark:border-white/10 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-white/5">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome, cargo ou matrícula..." 
                className="w-full bg-white dark:bg-[#2a2a2b] border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none focus:border-[#0866ff] transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="text-sm font-semibold text-gray-500 flex items-center gap-2">
              <Users size={16} />
              {filteredItems.length} Colaboradores listados
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center h-40 text-gray-500">Carregando dados...</div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-60 text-gray-500 gap-4">
                <Users size={48} className="opacity-20" />
                <p>Nenhum colaborador encontrado.</p>
                {items.length === 0 && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-[#0866ff] hover:underline flex items-center gap-2 font-semibold"
                  >
                    <Upload size={16} /> Fazer upload de planilha inicial
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-[#2a2a2b] border-b border-black/10 dark:border-white/10 text-gray-500 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="p-4">Matrícula Hydro</th>
                    <th className="p-4">Nome</th>
                    <th className="p-4">Cargo</th>
                    <th className="p-4">Admissional</th>

                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {filteredItems.map(item => (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedColaborador(item)}
                      className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="p-4 font-mono text-[13px] w-40">
                        {item.matricula || '-'}
                      </td>
                      <td className="p-4 font-bold max-w-xs truncate" title={item.nome}>{item.nome}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={item.cargo || ''}>{item.cargo || '-'}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {item.aso_admissional_2 ? item.aso_admissional_2.split('-').reverse().join('/') : '-'}
                      </td>
                      


                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                          item.status.toUpperCase() === 'ATIVO' || item.status.toUpperCase() === 'EFETIVADO' 
                            ? 'bg-[#39ff14]/10 text-[#39ff14] dark:bg-[#39ff14]/20 dark:text-[#39ff14] drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]' 
                            : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status.toUpperCase() === 'ATIVO' || item.status.toUpperCase() === 'EFETIVADO' 
                              ? 'bg-[#39ff14] shadow-[0_0_8px_#39ff14]' 
                              : 'bg-gray-500'
                          }`}></span>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Colaborador */}
      {selectedColaborador && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1b] text-gray-900 dark:text-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5 shrink-0">
              <div>
                <h2 className="text-xl font-bold">{selectedColaborador.nome}</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedColaborador.cargo || 'Sem cargo'}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save size={15} />
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
                {canEdit && (
                  <div className="relative">
                    <button
                      onClick={() => setShowDeleteConfirm(v => !v)}
                      className="p-2 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-colors"
                      title="Excluir colaborador"
                    >
                      <Trash2 size={18} />
                    </button>
                    {showDeleteConfirm && (
                      <div className="absolute right-0 top-10 z-50 bg-white dark:bg-[#2a2a2b] border border-red-300 dark:border-red-500/40 rounded-xl shadow-2xl p-4 w-64 animate-in fade-in zoom-in-95">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Excluir colaborador?</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteColaborador(selectedColaborador.id)}
                            className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Sim, excluir
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-sm rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => { setSelectedColaborador(null); setShowDeleteConfirm(false); }}
                  className="p-2 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                  <p className="font-medium text-[15px]">{selectedColaborador.status}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Matrícula Hydro</p>
                  {canEdit ? (
                    <input
                      type="text"
                      value={selectedColaborador.matricula || ''}
                      onChange={(e) => setSelectedColaborador({...selectedColaborador, matricula: e.target.value})}
                      onBlur={(e) => {
                        if (e.target.value !== (items.find(i => i.id === selectedColaborador.id)?.matricula || '')) {
                          handleUpdateField(selectedColaborador.id, 'matricula', e.target.value)
                        }
                      }}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm"
                      placeholder="Matrícula Hydro..."
                    />
                  ) : (
                    <p className="font-medium text-[15px]">{selectedColaborador.matricula || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Matrícula Sucena</p>
                  {canEdit ? (
                    <input
                      type="text"
                      value={selectedColaborador.matricula_sucena || ''}
                      onChange={(e) => setSelectedColaborador({...selectedColaborador, matricula_sucena: e.target.value})}
                      onBlur={(e) => {
                        if (e.target.value !== (items.find(i => i.id === selectedColaborador.id)?.matricula_sucena || '')) {
                          handleUpdateField(selectedColaborador.id, 'matricula_sucena', e.target.value)
                        }
                      }}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm"
                      placeholder="Matrícula Sucena..."
                    />
                  ) : (
                    <p className="font-medium text-[15px]">{selectedColaborador.matricula_sucena || '-'}</p>
                  )}
                </div>
                {/* Ocultando ASO Admissional daqui para criar uma seção dedicada */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Setor</p>
                  <p className="font-medium text-[15px]">{selectedColaborador.setor || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Função</p>
                  {canEdit ? (
                    <input 
                      type="text"
                      value={selectedColaborador.cargo || ''}
                      onChange={(e) => setSelectedColaborador({...selectedColaborador, cargo: e.target.value})}
                      onBlur={(e) => {
                        if (e.target.value !== (items.find(i => i.id === selectedColaborador.id)?.cargo || '')) {
                          handleUpdateField(selectedColaborador.id, 'cargo', e.target.value)
                        }
                      }}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm"
                      placeholder="Digite a função..."
                    />
                  ) : (
                    <p className="font-medium text-[15px]">{selectedColaborador.cargo || '-'}</p>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2 pt-4 border-t border-black/10 dark:border-white/10 mt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-bold text-lg">Controle Médico (ASO)</h3>
                    {canEdit && (
                      <button
                        onClick={() => setIsEditingAso(v => !v)}
                        className={`p-1.5 rounded-md transition-colors ${isEditingAso ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title={isEditingAso ? "Travar edição" : "Editar datas ASO"}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
                    {/* Admissional (Hiring Date) */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Admissional</p>
                      {canEdit ? (
                        <DateInput
                          value={selectedColaborador.aso_admissional_2 || ''}
                          onChange={(value) => {
                            setSelectedColaborador({...selectedColaborador, aso_admissional_2: value})
                            if (value !== (items.find(i => i.id === selectedColaborador.id)?.aso_admissional_2 || '')) {
                              handleUpdateField(selectedColaborador.id, 'aso_admissional_2', value)
                            }
                          }}
                          disabled={!isEditingAso}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm ${!isEditingAso ? 'opacity-60 cursor-not-allowed text-gray-500' : ''}`}
                        />
                      ) : (
                        <div className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 text-sm font-medium min-h-[38px] flex items-center opacity-60 cursor-not-allowed select-none">
                          {selectedColaborador.aso_admissional_2 ? selectedColaborador.aso_admissional_2.split('-').reverse().join('/') : <span className="text-gray-400">-</span>}
                        </div>
                      )}
                    </div>

                    {/* ASO Admissional (Medical Exam) */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">ASO Admissional</p>
                      {canEdit ? (
                        <DateInput
                          value={selectedColaborador.aso_admissional || ''}
                          onChange={(value) => {
                            setSelectedColaborador({...selectedColaborador, aso_admissional: value})
                            if (value !== (items.find(i => i.id === selectedColaborador.id)?.aso_admissional || '')) {
                              handleUpdateField(selectedColaborador.id, 'aso_admissional', value)
                            }
                          }}
                          disabled={!isEditingAso}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm ${!isEditingAso ? 'opacity-60 cursor-not-allowed text-gray-500' : ''}`}
                        />
                      ) : (
                        <p className="font-medium text-[15px]">{selectedColaborador.aso_admissional ? selectedColaborador.aso_admissional.split('-').reverse().join('/') : '-'}</p>
                      )}
                    </div>
                    
                    {/* ASO Periódico */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Periódico</p>
                      {canEdit ? (
                        <DateInput
                          value={selectedColaborador.aso_periodico || ''}
                          onChange={(value) => {
                            setSelectedColaborador({...selectedColaborador, aso_periodico: value})
                            if (value !== (items.find(i => i.id === selectedColaborador.id)?.aso_periodico || '')) {
                              handleUpdateField(selectedColaborador.id, 'aso_periodico', value)
                            }
                          }}
                          disabled={!isEditingAso}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm ${!isEditingAso ? 'opacity-60 cursor-not-allowed text-gray-500' : ''}`}
                        />
                      ) : (
                        <p className="font-medium text-[15px]">{selectedColaborador.aso_periodico ? selectedColaborador.aso_periodico.split('-').reverse().join('/') : '-'}</p>
                      )}
                    </div>

                    {/* Retorno ao Trabalho */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Retorno ao Trab.</p>
                      {canEdit ? (
                        <DateInput
                          value={selectedColaborador.retorno_ao_trabalho || ''}
                          onChange={(value) => {
                            setSelectedColaborador({...selectedColaborador, retorno_ao_trabalho: value})
                            if (value !== (items.find(i => i.id === selectedColaborador.id)?.retorno_ao_trabalho || '')) {
                              handleUpdateField(selectedColaborador.id, 'retorno_ao_trabalho', value)
                            }
                          }}
                          disabled={!isEditingAso}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm ${!isEditingAso ? 'opacity-60 cursor-not-allowed text-gray-500' : ''}`}
                        />
                      ) : (
                        <p className="font-medium text-[15px]">{selectedColaborador.retorno_ao_trabalho ? selectedColaborador.retorno_ao_trabalho.split('-').reverse().join('/') : '-'}</p>
                      )}
                    </div>

                    {/* Mudança de Risco */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mudança de Risco</p>
                      {canEdit ? (
                        <DateInput
                          value={selectedColaborador.mudanca_de_risco || ''}
                          onChange={(value) => {
                            setSelectedColaborador({...selectedColaborador, mudanca_de_risco: value})
                            if (value !== (items.find(i => i.id === selectedColaborador.id)?.mudanca_de_risco || '')) {
                              handleUpdateField(selectedColaborador.id, 'mudanca_de_risco', value)
                            }
                          }}
                          disabled={!isEditingAso}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm ${!isEditingAso ? 'opacity-60 cursor-not-allowed text-gray-500' : ''}`}
                        />
                      ) : (
                        <p className="font-medium text-[15px]">{selectedColaborador.mudanca_de_risco ? selectedColaborador.mudanca_de_risco.split('-').reverse().join('/') : '-'}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Observação */}
                    <div className="col-span-1">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Observação</p>
                      {canEdit ? (
                        <input 
                          type="text"
                          value={selectedColaborador.observacao || ''}
                          onChange={(e) => setSelectedColaborador({...selectedColaborador, observacao: e.target.value})}
                          onBlur={(e) => {
                            if (e.target.value !== (items.find(i => i.id === selectedColaborador.id)?.observacao || '')) {
                              handleUpdateField(selectedColaborador.id, 'observacao', e.target.value)
                            }
                          }}
                          className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-3 py-2 outline-none focus:border-[#0866ff] text-sm"
                          placeholder="Adicione uma observação..."
                        />
                      ) : (
                        <p className="font-medium text-[15px]">{selectedColaborador.observacao || '-'}</p>
                      )}
                    </div>

                    {/* Validade ASO Efetiva */}
                    <div className="col-span-1">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Validade ASO (Efetiva)</p>
                      {/* FRONTEND CALCULATION FOR VALIDADE ASO EFFECTIVE */}
                      <p className="font-bold text-[15px] text-[#0866ff] dark:text-white">{(() => { 
                        const item = items.find(i => i.id === selectedColaborador.id); 
                        if (item) { 
                          const dates = [
                            item.aso_admissional,
                            item.aso_periodico,
                            item.retorno_ao_trabalho,
                            item.mudanca_de_risco
                          ].filter(Boolean) as string[];
                          
                          if (dates.length > 0) {
                            const latestDate = dates.reduce((a, b) => (a > b ? a : b));
                            const date = new Date(latestDate + 'T12:00:00'); 
                            date.setFullYear(date.getFullYear() + 1); 
                            return date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'}); 
                          }
                        } 
                        return '-'; 
                      })()}</p>
                    </div>
                  </div>
                </div>
                
                {selectedColaborador.raw_data && Object.entries(selectedColaborador.raw_data).map(([key, value]) => {
                  // Skip existing/duplicated fields
                  const ignoreList = [
                    'nome', 'cargo', 'matricula', 'data de admissão', 'status', 'setor',
                    'qtd', '45 dias', '90 dias', 'função', 'admissão', 'localidade', 'colaborador', 'habilidades'
                  ];
                  if (ignoreList.includes(key.toLowerCase().trim())) return null;
                  if (value === null || value === undefined || value === '') return null;
                  
                  let displayValue = String(value);
                  // Format Excel serial dates (numbers between 30000 and 70000)
                  const numValue = Number(value);
                  if (!isNaN(numValue) && numValue > 30000 && numValue < 70000 && (key.toLowerCase().includes('data') || key.toLowerCase().includes('nascimento'))) {
                     const date = new Date((numValue - 25569) * 86400 * 1000);
                     date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
                     displayValue = date.toLocaleDateString('pt-BR');
                  }
                  
                  let displayKey = key;
                  if (displayKey.toUpperCase() === 'HABILIDADES') {
                    displayKey = 'Função';
                  }
                  
                  return (
                    <div key={key} className="col-span-1 sm:col-span-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{displayKey}</p>
                      <p className="font-medium text-[15px] whitespace-pre-wrap">{displayValue}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

