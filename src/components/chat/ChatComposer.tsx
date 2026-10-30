import Paperclip from 'lucide-react/dist/esm/icons/paperclip.js';
import Mic from 'lucide-react/dist/esm/icons/mic.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import Smile from 'lucide-react/dist/esm/icons/smile.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Square from 'lucide-react/dist/esm/icons/square.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import Pause from 'lucide-react/dist/esm/icons/pause.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import { sendMessage } from '../../lib/api-chat'
import { supabase } from '../../lib/supabase'

interface ChatComposerProps {
  currentUserId: string
  conversationId: string
  onMessageSent: () => void
}

export function ChatComposer({ currentUserId, conversationId, onMessageSent }: ChatComposerProps) {
  const { isDark } = useTheme()
  const [inputText, setInputText] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-ajuste de altura da caixa de texto sem barra de rolagem indesejada
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 22), 120)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [inputText])
  
  // Áudio
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<number | null>(null)

  const handleSendText = async () => {
    if (!inputText.trim()) return
    const text = inputText.trim()
    setInputText('')
    setShowEmojiPicker(false)
    try {
      await sendMessage({
        conversation_id: conversationId,
        sender_id: currentUserId,
        type: 'text',
        text: text
      })
      onMessageSent()
    } catch (e) {
      console.error(e)
      setInputText(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji)
  }

  // ==== GRAVAÇÃO DE ÁUDIO ====
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      intervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error("Erro ao acessar microfone", err)
      alert("Não foi possível acessar o microfone.")
    }
  }

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (!cancel) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          await uploadAndSendAudio(audioBlob)
        }
        
        // Limpar stream
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop())
        mediaRecorderRef.current = null
        audioChunksRef.current = []
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  const uploadAndSendAudio = async (blob: Blob) => {
    const fileName = `audio_${Date.now()}.webm`
    const filePath = `${conversationId}/${fileName}`
    
    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat_media')
      .upload(filePath, blob, { contentType: 'audio/webm' })
      
    if (uploadError) {
      console.error("Upload error", uploadError)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath)

    // Enviar mensagem do tipo áudio (simplificado)
    await sendMessage({
      conversation_id: conversationId,
      sender_id: currentUserId,
      type: 'audio',
      text: `${publicUrl}|Áudio Gravado`,
    })
    
    onMessageSent()
  }

  // ==== UPLOAD DE ARQUIVOS (Mídia/Docs) ====
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      let msgType: 'image' | 'video' | 'audio' | 'document' = 'document'
      if (file.type.startsWith('image/')) msgType = 'image'
      else if (file.type.startsWith('video/')) msgType = 'video'
      else if (file.type.startsWith('audio/')) msgType = 'audio'

      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${msgType}_${Date.now()}_${safeName}`
      const filePath = `${conversationId}/${fileName}`

      const { error } = await supabase.storage
        .from('chat_media')
        .upload(filePath, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath)

      await sendMessage({
        conversation_id: conversationId,
        sender_id: currentUserId,
        type: msgType,
        text: `${publicUrl}|${file.name}`,
      })

      onMessageSent()
    } catch (err) {
      console.error("Erro no upload", err)
      alert("Falha ao enviar imagem.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className={`relative shrink-0 p-2 sm:p-2.5 flex items-end gap-1.5 border-t z-10 ${isDark ? 'border-white/5 bg-[#111216]' : 'border-black/5 bg-[#f0f2f5]'}`}>
      {/* EMOJI PICKER MODAL */}
      {showEmojiPicker && (
        <div className="absolute bottom-14 left-2 z-50 shadow-xl rounded-lg overflow-hidden">
          <EmojiPicker 
            onEmojiClick={onEmojiClick}
            theme={isDark ? Theme.DARK : Theme.LIGHT}
            searchPlaceHolder="Pesquisar emoji..."
            lazyLoadEmojis={true}
          />
        </div>
      )}

      {isRecording ? (
        // MODO GRAVAÇÃO DE ÁUDIO
        <div className="flex-1 flex items-center justify-between min-h-[40px] px-3 bg-red-500/10 rounded-xl">
          <div className="flex items-center gap-3 text-red-500 animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="font-mono font-medium text-sm">{formatTime(recordingTime)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => stopRecording(true)} className="p-1.5 text-gray-500 hover:text-red-500 transition-colors">
              <span className="text-xs font-medium">Cancelar</span>
            </button>
            <button onClick={() => stopRecording(false)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
              <Send size={16} className="ml-0.5" />
            </button>
          </div>
        </div>
      ) : (
        // MODO NORMAL DE TEXTO
        <>
          <button 
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 shrink-0 rounded-full transition-colors ${isDark ? (showEmojiPicker ? 'text-[#D6A72B] bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5') : (showEmojiPicker ? 'text-yellow-600 bg-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200')}`}
            title="Inserir emoji"
          >
            <Smile size={18} />
          </button>
          
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`p-2 shrink-0 rounded-full transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'} ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
            title="Anexar arquivo ou foto"
          >
            <Paperclip size={18} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,video/*,audio/*,.zip,.rar,application/zip,application/x-rar-compressed" 
            className="hidden" 
          />
          
          <div className={`flex-1 min-w-0 rounded-2xl flex items-center px-3.5 py-1.5 border transition-colors shadow-2xs ${isDark ? 'bg-[#18191E] border-white/10 focus-within:border-[#D6A72B]/60' : 'bg-white border-gray-300 focus-within:border-gray-400'}`}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              rows={1}
              className="w-full bg-transparent outline-none resize-none text-[14px] leading-snug text-gray-900 dark:text-gray-100 placeholder:text-gray-400 overflow-y-auto"
              style={{
                minHeight: '22px',
                maxHeight: '120px',
                fontFamily: '"Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                scrollbarWidth: 'none',
              }}
            />
          </div>
          
          <button 
            type="button"
            onClick={inputText ? handleSendText : startRecording}
            className={`p-2 shrink-0 rounded-full transition-all shadow-xs ${ inputText ? (isDark ? 'bg-[#D6A72B] text-black hover:bg-[#E2BB57]' : 'bg-[#00a884] text-white hover:bg-[#008f6f]') : (isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200') }`}
            title={inputText ? 'Enviar mensagem' : 'Gravar áudio'}
          >
            {inputText ? <Send size={16} className="ml-0.5" /> : <Mic size={18} />}
          </button>
        </>
      )}
    </div>
  )
}

