import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { 
  Users, 
  Upload, 
  FileSpreadsheet, 
  Search, 
  X, 
  ArrowLeft,
  Filter
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useTheme } from '../../contexts/ThemeContext'

export const Route = createFileRoute('/rh/efetivo')({
  component: RhEfetivoPage,
})

type EfetivoItem = {
  id: string
  nome: string
  cargo: string | null
  matricula: string | null
  data_admissao: string | null
  status: string
  setor: string | null
  raw_data?: any
}

function RhEfetivoPage() {
  const { isDark } = useTheme()
  const [items, setItems] = useState<EfetivoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [selectedColaborador, setSelectedColaborador] = useState<EfetivoItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || null)
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
            const status = getVal(['STATUS', 'SITUAÇÃO', 'SITUACAO']) || 'ATIVO'
            const setor = getVal(['SETOR', 'DEPARTAMENTO', 'ÁREA', 'AREA', 'LOCALIDADE', 'LOCALIDADE '])
            
            // Format admission date if exists
            let dataAdmissao = getVal(['DATA DE ADMISSÃO', 'ADMISSÃO', 'ADMISSAO', 'DATA ADMISSAO'])
            if (typeof dataAdmissao === 'number') {
              const d = new Date((dataAdmissao - (25567 + 2)) * 86400 * 1000)
              dataAdmissao = d.toISOString().split('T')[0]
            } else if (typeof dataAdmissao === 'string' && dataAdmissao.includes('/')) {
              const parts = dataAdmissao.split('/')
              if (parts.length === 3) dataAdmissao = `${parts[2]}-${parts[1]}-${parts[0]}`
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
              status: String(status),
              setor: setor ? String(setor) : null,
              data_admissao: dataAdmissao ? String(dataAdmissao) : null,
              raw_data: row
            }
          })

          // Prevent duplicates and retrieve existing matriculas
          const { data: existingData } = await supabase.from('rh_efetivo').select('id, nome, matricula')
          const existingMap = new Map((existingData || []).map(d => [d.nome.toUpperCase(), d]))

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
          existingMap.forEach((rec, upperName) => {
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

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      item.nome.toLowerCase().includes(q) ||
      (item.cargo?.toLowerCase().includes(q)) ||
      (item.matricula?.toLowerCase().includes(q))
    )
  })

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-gray-900 dark:text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto flex-1">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/rh" className="text-gray-500 hover:text-black dark:hover:text-gray-900 dark:text-white transition-colors">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="font-display italic tracking-tight" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>Efetivo</h1>
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
              className="bg-green-600 hover:bg-green-700 text-gray-900 dark:text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              {isImporting ? 'Lendo...' : 'Importar Planilha'}
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
                    <th className="p-4">Matrícula</th>
                    <th className="p-4">Nome</th>
                    <th className="p-4">Cargo</th>
                    <th className="p-4">Contato</th>
                    <th className="p-4">Data de Admissão</th>
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
                      <td className="p-4 font-mono text-xs w-40" onClick={e => e.stopPropagation()}>
                        {userEmail === 'ffaahsiilva@gmail.com' ? (
                          <input 
                            type="text"
                            defaultValue={item.matricula || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (item.matricula || '')) {
                                handleUpdateMatricula(item.id, e.target.value)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-2 py-1 outline-none focus:border-[#0866ff]"
                            placeholder="Vazio"
                          />
                        ) : (
                          item.matricula || '-'
                        )}
                      </td>
                      <td className="p-4 font-bold">{item.nome}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{item.cargo || '-'}</td>
                      <td className="p-4">{item.raw_data?.CONTATO || '-'}</td>
                      <td className="p-4">{item.data_admissao ? item.data_admissao.split('-').reverse().join('/') : '-'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5
                          ${item.status.toUpperCase() === 'ATIVO' ? 'bg-green-500/20 text-green-600 dark:text-green-500' : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.status.toUpperCase() === 'ATIVO' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
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
      {selectedColaborador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1b] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5 shrink-0">
              <div>
                <h2 className="text-xl font-bold">{selectedColaborador.nome}</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedColaborador.cargo || 'Sem cargo'}</p>
              </div>
              <button 
                onClick={() => setSelectedColaborador(null)}
                className="p-2 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                  <p className="font-medium text-[15px]">{selectedColaborador.status}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Matrícula</p>
                  <p className="font-medium text-[15px]">{selectedColaborador.matricula || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data de Admissão</p>
                  <p className="font-medium text-[15px]">{selectedColaborador.data_admissao ? selectedColaborador.data_admissao.split('-').reverse().join('/') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Setor</p>
                  <p className="font-medium text-[15px]">{selectedColaborador.setor || '-'}</p>
                </div>
                
                {selectedColaborador.raw_data && Object.entries(selectedColaborador.raw_data).map(([key, value]) => {
                  // Skip existing fields
                  if (['nome', 'cargo', 'matricula', 'data de admissão', 'status', 'setor'].includes(key.toLowerCase())) return null;
                  if (value === null || value === undefined || value === '') return null;
                  
                  return (
                    <div key={key} className="col-span-1 sm:col-span-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{key}</p>
                      <p className="font-medium text-[15px] whitespace-pre-wrap">{String(value)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

