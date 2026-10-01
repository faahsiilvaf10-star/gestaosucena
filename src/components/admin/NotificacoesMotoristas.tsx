import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import Send from 'lucide-react/dist/esm/icons/send.js'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.js'
import Search from 'lucide-react/dist/esm/icons/search.js'

export function NotificacoesMotoristas({ isDark }: { isDark: boolean }) {
  const [motoristas, setMotoristas] = useState<{ id: string, name: string, matricula: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMotorista, setSelectedMotorista] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function loadMotoristas() {
      try {
        const { data, error } = await supabase
          .from('rh_efetivo')
          .select('id, name, matricula')
          .order('name', { ascending: true })

        if (error) throw error
        setMotoristas(data || [])
      } catch (err) {
        console.error('Erro ao carregar motoristas:', err)
        toast.error('Erro ao carregar motoristas')
      } finally {
        setLoading(false)
      }
    }
    loadMotoristas()
  }, [])

  const filteredMotoristas = motoristas.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.matricula && m.matricula.includes(searchTerm))
  )

  const handleSend = async () => {
    if (!selectedMotorista) {
      toast.error('Selecione um motorista')
      return
    }
    if (!title.trim() || !body.trim()) {
      toast.error('Preencha título e mensagem')
      return
    }

    setSending(true)
    try {
      const { error } = await supabase.from('app_notifications').insert({
        driver_id: selectedMotorista,
        title: title.trim(),
        body: body.trim()
      })

      if (error) throw error
      
      toast.success('Notificação enviada com sucesso!')
      setTitle('')
      setBody('')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao enviar notificação')
    } finally {
      setSending(false)
    }
  }

  const handleSendAll = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Preencha título e mensagem')
      return
    }
    if (!confirm('Tem certeza que deseja enviar esta notificação para TODOS os motoristas cadastrados?')) return

    setSending(true)
    try {
      const payloads = motoristas.map(m => ({
        driver_id: m.id,
        title: title.trim(),
        body: body.trim()
      }))
      
      const { error } = await supabase.from('app_notifications').insert(payloads)

      if (error) throw error
      
      toast.success(`Notificação enviada para ${motoristas.length} motoristas!`)
      setTitle('')
      setBody('')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao enviar notificação em massa')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`rounded-2xl p-6 shadow-sm border ${isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/20 text-blue-500 rounded-xl">
          <Smartphone size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Notificações no App (Push Local)</h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Envie mensagens diretamente para o celular dos motoristas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lado Esquerdo: Seleção do Motorista */}
        <div>
          <h3 className="text-lg font-semibold mb-4">1. Selecionar Destinatário</h3>
          
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 ${isDark ? 'bg-[#0a0a0c] border-white/10 focus-within:border-blue-500' : 'bg-gray-50 border-gray-200 focus-within:border-blue-500'}`}>
            <Search size={16} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar motorista por nome..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm"
            />
          </div>

          <div className={`border rounded-lg max-h-64 overflow-y-auto custom-scrollbar ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">Carregando...</div>
            ) : filteredMotoristas.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">Nenhum motorista encontrado</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                <div 
                  className={`p-3 cursor-pointer transition-colors ${selectedMotorista === null ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'hover:bg-black/5 dark:hover:bg-white/5 border-l-2 border-transparent'}`}
                  onClick={() => setSelectedMotorista(null)}
                >
                  <p className="font-semibold text-blue-500 text-sm">Nenhum Selecionado</p>
                  <p className="text-xs text-gray-500">Ou envie para todos abaixo</p>
                </div>
                {filteredMotoristas.map(m => (
                  <div 
                    key={m.id}
                    className={`p-3 cursor-pointer transition-colors ${selectedMotorista === m.id ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'hover:bg-black/5 dark:hover:bg-white/5 border-l-2 border-transparent'}`}
                    onClick={() => setSelectedMotorista(m.id)}
                  >
                    <p className="font-semibold text-sm">{m.name}</p>
                    {m.matricula && <p className="text-xs text-gray-500">Matrícula: {m.matricula}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Composição da Mensagem */}
        <div>
          <h3 className="text-lg font-semibold mb-4">2. Compor Mensagem</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Novo Aviso"
                className={`w-full p-3 rounded-lg border ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-blue-500' : 'bg-gray-50 border-gray-200 focus:border-blue-500'} outline-none`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mensagem</label>
              <textarea 
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Escreva a mensagem aqui..."
                rows={4}
                className={`w-full p-3 rounded-lg border ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-blue-500' : 'bg-gray-50 border-gray-200 focus:border-blue-500'} outline-none resize-none`}
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button 
                onClick={handleSendAll}
                disabled={sending}
                className="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-sm font-semibold rounded-lg transition-colors"
              >
                Enviar para TODOS
              </button>
              <button 
                onClick={handleSend}
                disabled={sending || !selectedMotorista}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {sending ? 'Enviando...' : 'Enviar para Motorista'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
