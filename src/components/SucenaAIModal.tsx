import React, { useState, useEffect, useRef } from 'react'
import { X, Send, Bot, KeyRound, ExternalLink, Loader2, Database, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import { useTheme } from '../contexts/ThemeContext'
import { getAITokens, setAITokens } from '../lib/settings'

export default function SucenaAIModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { isDark } = useTheme()
  const [apiKey, setApiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [gatheringData, setGatheringData] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      getAITokens().then(tokens => {
        if (tokens.geminiKey) {
          setApiKey(tokens.geminiKey)
          setHasKey(true)
        }
        if (tokens.groqKey) {
          setGroqKey(tokens.groqKey)
        }
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, gatheringData])

  const saveKey = async () => {
    if (apiKey.trim().length > 10) {
      const gKey = apiKey.trim()
      const grKey = groqKey.trim()
      
      await setAITokens(gKey, grKey)
      
      setHasKey(true)
      setMessages([{ role: 'ai', text: 'Olá! Sou a IA da Gestão Sucena. Estou conectada ao seu banco de dados e pronta para responder perguntas sobre o almoxarifado, movimentações, quantidades e equipamentos. Como posso ajudar hoje?' }])
    }
  }

  const removeKey = async () => {
    await setAITokens('', '')
    setApiKey('')
    setGroqKey('')
    setHasKey(false)
    setMessages([])
  }

  const gatherSystemContext = async () => {
    setGatheringData(true)
    try {
      // 1. Produtos e Estoque (Movimentação Manual e Quantidade)
      const { data: products } = await supabase.from('al_products').select('id, name, current_stock, unit_of_measure, min_stock')
      
      // 2. Equipamentos
      const { data: equipments } = await supabase.from('eq_equipments').select('name, plate_tag, type, location_status')

      // 3. Efetivo
      const { data: employees } = await supabase.from('rh_efetivo').select('nome, funcao, status')

      const context = `
VOCÊ É A SUCENA AI, UMA ASSISTENTE INTELIGENTE PARA O SISTEMA "GESTÃO SUCENA".
RESPONDA SEMPRE EM PORTUGUÊS (PT-BR). SEJA DIRETO E PROFISSIONAL.
Abaixo estão os dados reais do banco de dados neste exato momento. Responda às perguntas com base estritamente nestes dados:

### ESTOQUE E ALMOXARIFADO (MOVIMENTAÇÕES / QUANTIDADES)
${products ? products.map(p => `- Produto: ${p.name} | Estoque Atual: ${p.current_stock} ${p.unit_of_measure} | Estoque Mín: ${p.min_stock}`).join('\n') : 'Sem dados'}

### EQUIPAMENTOS (FROTA)
${equipments ? equipments.map(e => `- Eqp: ${e.name} (${e.plate_tag}) | Tipo: ${e.type} | Status: ${e.location_status}`).join('\n') : 'Sem dados'}

### FUNCIONÁRIOS ATIVOS (RH)
${employees ? employees.map(e => `- Func: ${e.nome} | Função: ${e.funcao} | Status: ${e.status}`).join('\n') : 'Sem dados'}
`
      return context
    } catch (error) {
      console.error('Error gathering context:', error)
      return "Erro ao ler o banco de dados."
    } finally {
      setGatheringData(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !apiKey) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setLoading(true)

    let context = ''
    try {
      context = await gatherSystemContext()
      
      // 1. Tenta usar Groq como PRINCIPAL (se a chave existir)
      if (groqKey) {
        try {
          const groq = new Groq({ dangerouslyAllowBrowser: true, apiKey: groqKey })
          
          const groqHistory: any[] = messages
            .filter(m => !m.text.includes('Olá! Sou a IA') && !m.text.includes('IA Reserva'))
            .map(m => ({
              role: m.role === 'ai' ? 'assistant' : 'user',
              content: m.text
            }))
            
          const chatCompletion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: context },
              ...groqHistory,
              { role: 'user', content: userMessage }
            ],
            model: 'llama-3.1-70b-versatile',
          })
          
          const responseText = chatCompletion.choices[0]?.message?.content || 'Sem resposta do Groq.'
          setMessages(prev => [...prev, { role: 'ai', text: responseText }])
          setLoading(false)
          return
        } catch(groqError: any) {
          console.error("Groq as primary failed, falling back to Gemini:", groqError)
          setMessages(prev => [...prev, { role: 'ai', text: `Groq indisponível no momento (${groqError.message}). Acionando IA Reserva (Google Gemini)...` }])
        }
      }

      // 2. Se Groq falhou ou não tem chave Groq, tenta Gemini (RESERVA)
      const genAI = new GoogleGenerativeAI(apiKey)
      
      const model = genAI.getGenerativeModel({ 
        model: "gemini-flash-latest",
        systemInstruction: context
      })

      // Convert previous messages to Gemini format
      const history = messages
        .filter(m => !m.text.includes('Olá! Sou a IA') && !m.text.includes('IA Reserva'))
        .map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }))

      const chat = model.startChat({
        history: history,
      })

      const result = await chat.sendMessage(userMessage)
      const responseText = result.response.text()

      setMessages(prev => [...prev, { role: 'ai', text: responseText }])
    } catch (error: any) {
      console.error("Gemini Error:", error)
      let errorMessage = `Desculpe, ocorreu um erro de conexão com a IA: ${error.message}`;
      
      if (error.message?.includes('503') || error.message?.includes('high demand') || error.message?.includes('429')) {
         errorMessage = groqKey 
           ? "Ambas as IAs (Groq Llama-3 e Google Gemini) falharam por congestionamento ou erro. Tente novamente mais tarde."
           : "A IA do Google está com volume muito alto e você não tem uma chave do Groq configurada como fallback. Aguarde alguns segundos e tente novamente.";
      }

      setMessages(prev => [...prev, { role: 'ai', text: errorMessage }])
      
      if (error.message?.includes('API key not valid')) {
        removeKey()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl h-[85vh] bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg dark:text-white flex items-center gap-2">Sucena AI <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500 text-[10px] uppercase tracking-wider">Beta</span></h2>
              <p className="text-xs text-gray-500 dark:text-white/50">Treinada com os dados do seu sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasKey && (
              <button onClick={removeKey} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Remover API Key">
                <ShieldAlert size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-black/20 p-6 flex flex-col">
          {!hasKey ? (
            <div className="m-auto max-w-md w-full bg-white dark:bg-[#1a1a1c] p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xl text-center">
              <div className="w-16 h-16 mx-auto bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-6">
                <KeyRound size={32} />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">Conecte a Inteligência Artificial</h3>
              <p className="text-sm text-gray-500 dark:text-white/60 mb-6">
                Para usar a IA da Sucena gratuitamente e sem limites, você precisa de uma chave do Google Gemini (é 100% grátis e super potente).
              </p>
              
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium text-sm mb-6 bg-blue-500/10 px-4 py-2 rounded-lg transition-colors">
                Gerar Chave do Google Gemini <ExternalLink size={14} />
              </a>

              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Cole sua API Key do Google aqui..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-sm"
                />
                <input
                  type="password"
                  placeholder="[Opcional] Cole sua API Key do Groq aqui..."
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-center text-sm"
                />
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="block text-xs text-orange-500 hover:text-orange-600 mb-2 mt-1">
                  Não tem a chave Groq? Gere uma aqui de graça (Evita erros 503)
                </a>
                <button
                  onClick={saveKey}
                  disabled={apiKey.length < 10}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                  Conectar e Treinar IA
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col justify-end">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mt-1">
                      <Bot size={14} />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-500/20' 
                      : 'bg-white dark:bg-[#1a1a1c] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-white/5 shadow-sm rounded-bl-none whitespace-pre-wrap'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full shrink-0 bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-white mt-1 uppercase text-xs font-bold">
                      VOC
                    </div>
                  )}
                </div>
              ))}
              
              {(gatheringData || loading) && (
                <div className="flex gap-4 justify-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mt-1">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white dark:bg-[#1a1a1c] text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-white/5 rounded-2xl rounded-bl-none px-5 py-3.5 text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {gatheringData ? 'Lendo o banco de dados...' : 'Pensando...'}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT */}
        {hasKey && (
          <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214]">
            <div className="flex items-center gap-2 relative">
              <div className="absolute left-4 flex items-center gap-2 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-md font-medium">
                <Database size={12} /> Sync Ativo
              </div>
              <input
                type="text"
                placeholder="Pergunte sobre as movimentações, estoque, equipamentos..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                disabled={loading || gatheringData}
                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl pl-28 pr-12 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || gatheringData}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-white/10 text-white rounded-lg flex items-center justify-center transition-colors shadow-md"
              >
                <Send size={16} className={input.trim() && !loading ? 'translate-x-0.5' : ''} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
