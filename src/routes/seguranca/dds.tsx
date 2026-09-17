import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addMonths, subMonths, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  Sun, Calendar as CalendarIcon, BookOpen, ChevronLeft, ChevronRight, 
  Shuffle, Trash2, Edit2, ImageIcon 
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Helper para feriados móveis e fixos no Brasil
function getEaster(year: number) {
  const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

function getFeriados(year: number) {
  const easter = getEaster(year);
  const carnaval = new Date(easter.getTime());
  carnaval.setDate(easter.getDate() - 47);
  const paixao = new Date(easter.getTime());
  paixao.setDate(easter.getDate() - 2);
  const corpusChristi = new Date(easter.getTime());
  corpusChristi.setDate(easter.getDate() + 60);

  const formatFeriado = (d: Date) => format(d, 'MM-dd');

  return [
    '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25',
    formatFeriado(carnaval),
    formatFeriado(paixao),
    formatFeriado(corpusChristi)
  ];
}

function isFeriado(date: Date) {
  const feriados = getFeriados(date.getFullYear());
  return feriados.includes(format(date, 'MM-dd'));
}

export const Route = createFileRoute('/seguranca/dds')({
  component: DDSSchedulePage,
})

function DDSSchedulePage() {
  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  
  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [tema, setTema] = useState('')
  const [palestranteId, setPalestranteId] = useState('')
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, title: string, message: string, action: () => void}>({ isOpen: false, title: '', message: '', action: () => {} })

  // Fetch employees from system users (via RPC)
  const { data: employees = [] } = useQuery({
    queryKey: ['system_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_users')
      if (error) {
        console.error("Erro ao buscar usuários do sistema:", error)
        throw error
      }
      return data || []
    }
  })

  // Fetch month schedule
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthStartStr = format(monthStart, 'yyyy-MM-dd')
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

  const { data: schedule = [] } = useQuery({
    queryKey: ['seguranca_dds', monthStartStr, monthEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seguranca_dds')
        .select('id, date, tema, palestrante_id')
        .gte('date', monthStartStr)
        .lte('date', monthEndStr)
      if (error) {
        console.error("Erro ao buscar agendamentos:", error)
        throw error
      }
      return data || []
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { date: string, tema: string, palestrante_id: string }) => {
      const { error } = await supabase
        .from('seguranca_dds')
        .upsert({
          date: data.date,
          tema: data.tema,
          palestrante_id: data.palestrante_id || null
        }, { onConflict: 'date' })
      if (error) {
        console.error("Erro no upsert:", error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
      setEditDialogOpen(false)
      toast.success("Salvo com sucesso!")
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (dateStr: string) => {
      const { error } = await supabase
        .from('seguranca_dds')
        .delete()
        .eq('date', dateStr)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
    }
  })

  const generateRandomMutation = useMutation({
    mutationFn: async () => {
      if (employees.length === 0) return

      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const workDays = monthDays.filter(d => !isWeekend(d) && !isFeriado(d))
      
      const toUpsert = []
      let empIndex = 0
      
      // Shuffle employees array for randomness
      const shuffled = [...employees].sort(() => 0.5 - Math.random())

      for (const day of workDays) {
        const dateStr = format(day, 'yyyy-MM-dd')
        
        // Skip if already has an entry
        if (schedule.some(s => s.date === dateStr)) {
          continue
        }

        const palestrante = shuffled[empIndex % shuffled.length]
        toUpsert.push({
          date: dateStr,
          palestrante_id: palestrante.id,
          tema: 'TEMA A DEFINIR'
        })
        
        empIndex++
      }

      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('seguranca_dds')
          .upsert(toUpsert, { onConflict: 'date' })
        if (error) {
          console.error("Erro no randomize:", error)
          throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
      toast.success("Dias preenchidos com sucesso!")
    },
    onError: (err: any) => {
      toast.error("Erro ao gerar aleatórios: " + err.message)
    }
  })

  const clearMonthMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('seguranca_dds')
        .delete()
        .gte('date', monthStartStr)
        .lte('date', monthEndStr)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
    }
  })

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  const openEdit = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const entry = scheduleMap.get(dateStr)
    
    setSelectedDate(date)
    setTema(entry?.tema || '')
    setPalestranteId(entry?.palestrante_id || '')
    setEditDialogOpen(true)
  }

  const handleSave = () => {
    if (!selectedDate) return
    saveMutation.mutate({
      date: format(selectedDate, 'yyyy-MM-dd'),
      tema: tema.toUpperCase(), // Formatação MAIÚSCULO pedida
      palestrante_id: palestranteId
    })
  }

  const handleDelete = (date: Date) => {
    setConfirmAction({
      isOpen: true,
      title: 'Remover Agendamento',
      message: 'Tem certeza que deseja remover o agendamento deste dia?',
      action: () => deleteMutation.mutate(format(date, 'yyyy-MM-dd'))
    })
  }

  const handleRandomize = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Definir Aleatoriamente',
      message: 'Preencher os dias vazios deste mês com funcionários aleatórios?',
      action: () => generateRandomMutation.mutate()
    })
  }

  const handleClearMonth = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Limpar Mês',
      message: 'Tem certeza que deseja limpar toda a escala deste mês?',
      action: () => clearMonthMutation.mutate()
    })
  }

  // Build the list of days for the table
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const workDays = daysInMonth.filter(d => !isWeekend(d) && !isFeriado(d))
  
  const scheduleMap = useMemo(() => {
    const map = new Map()
    schedule.forEach((s: any) => {
      const emp = employees.find((e: any) => e.id === s.palestrante_id)
      map.set(s.date, {
        ...s,
        palestrante: emp ? { id: emp.id, nome: emp.nome, cargo: emp.cargo, avatar_url: emp.avatar_url } : null
      })
    })
    return map
  }, [schedule, employees])

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-black">
      {/* Header section */}
      <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="space-y-2">
          <div className="flex items-center space-x-3 text-black">
            <Sun className="w-8 h-8" />
            <h1 className="text-3xl md:text-4xl font-display font-bold italic tracking-tight text-black">
              DDS - Diálogo de Segurança
            </h1>
          </div>
          <p className="text-gray-500">Gerencie escalas e consulte os temas programados</p>
        </div>

        {/* Tabs and Nav */}
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="flex bg-white shadow-sm border border-gray-200 rounded-xl p-1">
            <button className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-black text-white text-sm font-medium transition-colors">
              <CalendarIcon className="w-4 h-4" />
              <span>Escala do Mês</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={handlePrevMonth} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="bg-white border border-gray-200 px-6 py-2 rounded-lg font-medium min-w-[160px] text-center capitalize text-black shadow-sm">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </div>
            <button onClick={handleNextMonth} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <h2 className="text-xl font-display font-bold italic mb-2">Ações Rápidas</h2>
          <p className="text-gray-500 text-sm mb-6">Gerencie a escala do mês</p>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleRandomize} 
              disabled={generateRandomMutation.isPending}
              className="bg-black hover:bg-gray-800 text-white font-medium border-0"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Definir Aleatoriamente
            </Button>
            <Button 
              onClick={handleClearMonth}
              disabled={clearMonthMutation.isPending}
              variant="outline" 
              className="bg-transparent hover:bg-red-50 text-red-600 border-gray-200 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Mês
            </Button>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3 mb-1">
              <CalendarIcon className="w-5 h-5 text-gray-500" />
              <h2 className="text-2xl font-display font-bold italic text-black">Escala do Mês</h2>
            </div>
            <p className="text-gray-500 text-sm">
              {workDays.length} dias úteis • {schedule.length} agendamentos
            </p>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase bg-gray-50 font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Data</th>
                  <th className="px-6 py-4 whitespace-nowrap">Dia</th>
                  <th className="px-6 py-4 whitespace-nowrap">Palestrante</th>
                  <th className="px-6 py-4 whitespace-nowrap">Tema</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const entry = scheduleMap.get(dateStr)
                  
                  return (
                    <tr key={dateStr} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4 font-bold text-black whitespace-nowrap">
                        {format(day, 'dd/MM')}
                      </td>
                      <td className="px-6 py-4 text-gray-500 capitalize whitespace-nowrap">
                        {format(day, 'EEE', { locale: ptBR }).replace('.', '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry?.palestrante ? (
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border border-blue-300 text-blue-700 font-bold overflow-hidden shadow-sm">
                              {entry.palestrante.avatar_url ? (
                                <img src={entry.palestrante.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                entry.palestrante.nome.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-black">{entry.palestrante.nome}</p>
                              <p className="text-xs text-gray-500">{entry.palestrante.cargo}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Não definido</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {entry?.tema ? (
                          <div className="flex items-center space-x-2 text-gray-700 font-medium">
                            <span className="line-clamp-2">{entry.tema}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEdit(day)}
                            className="p-2 text-gray-400 hover:text-black transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {entry && (
                            <button 
                              onClick={() => handleDelete(day)}
                              className="p-2 text-gray-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col divide-y divide-gray-100">
            {workDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const entry = scheduleMap.get(dateStr)
              
              return (
                <div key={dateStr} className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-black text-xl">{format(day, 'dd/MM')}</span>
                      <span className="text-gray-500 capitalize text-sm">{format(day, 'EEEE', { locale: ptBR })}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(day)} className="p-2.5 text-gray-500 hover:text-black bg-gray-50 border border-gray-200 rounded-xl transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {entry && (
                        <button onClick={() => handleDelete(day)} className="p-2.5 text-red-500 hover:text-red-700 bg-red-50 border border-red-100 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col justify-center border border-gray-100">
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Palestrante</div>
                      {entry?.palestrante ? (
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border border-blue-300 text-blue-700 font-bold overflow-hidden shadow-sm shrink-0">
                            {entry.palestrante.avatar_url ? (
                              <img src={entry.palestrante.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              entry.palestrante.nome.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-sm truncate">{entry.palestrante.nome}</p>
                            <p className="text-xs text-gray-500 truncate">{entry.palestrante.cargo}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Não definido</span>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col justify-center border border-gray-100">
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tema</div>
                      {entry?.tema ? (
                        <div className="flex items-center space-x-2 text-gray-800 font-medium text-sm leading-snug">
                          <span>{entry.tema}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">-</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-gray-200 text-black">
          <DialogHeader>
            <DialogTitle className="font-display font-bold italic text-2xl text-black">
              Agendar DDS - {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            
            <div className="space-y-2 flex flex-col">
              <Label className="text-gray-700">Palestrante</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between bg-white border-gray-300 hover:bg-gray-50 text-black"
                  >
                    {palestranteId
                      ? employees.find((e) => e.id === palestranteId)?.nome
                      : "Selecione o palestrante..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0 bg-white border-gray-200 text-black shadow-lg rounded-xl">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Buscar colaborador..." className="text-black" />
                    <CommandList>
                      <CommandEmpty className="py-4 text-center text-sm text-gray-500">Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={emp.nome}
                            onSelect={() => {
                              setPalestranteId(emp.id)
                              setComboboxOpen(false)
                            }}
                            className="text-black hover:bg-gray-100 cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                palestranteId === emp.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {emp.nome} - <span className="text-gray-500 text-xs ml-1">{emp.cargo}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tema" className="text-gray-700">Tema</Label>
              <Input
                id="tema"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: USO CORRETO DE EPIS"
                className="bg-white border-gray-300 text-black focus-visible:ring-black uppercase"
              />
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white border-0"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={confirmAction.isOpen} onOpenChange={(open) => !open && setConfirmAction(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className="sm:max-w-[425px] bg-white border-gray-200 text-black">
          <DialogHeader>
            <DialogTitle className="font-display font-bold italic text-2xl text-black">
              {confirmAction.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-[#495057] text-base">
            {confirmAction.message}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" className="w-full sm:w-auto bg-white border-gray-300 text-black hover:bg-gray-50" onClick={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                confirmAction.action()
                setConfirmAction(prev => ({ ...prev, isOpen: false }))
              }}
              className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white border-0"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
