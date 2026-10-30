import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export const Route = createFileRoute('/seguranca/inspecao-canteiro')({
  component: InspecaoCanteiroPage,
})

interface PontoInspecao {
  uid: string
  titulo: string
  obs: string
  cat: string
  prio: string
  foto?: string
  corrigido: boolean
  fotoCorrecao?: string
  obsCorrecao?: string
  dataCorrecao?: string
}

interface InspecaoRegistro {
  data: string
  local: string
  responsavel: string
  turno: string
  area: string
  salvoEm: string
  itens: PontoInspecao[]
}

interface DraftItem {
  id: number
  cat: string
  prio: string
  titulo: string
  obs: string
  foto: string
}

const CATEGORIAS = [
  'Organização e limpeza',
  'EPI / EPC',
  'Sinalização',
  'Acesso e circulação',
  'Guarda-corpo / Proteção coletiva',
  'Elétrica',
  'Armazenamento de materiais',
  'Meio ambiente',
  'Outro',
]

const PRIORIDADES = [
  'Atenção — melhoria',
  'Alta — corrigir urgente',
  'Média',
  'Baixa',
]

const TURNOS = ['Manhã', 'Tarde', 'Dia todo']

// Compressão de imagem via Canvas para armazenamento confiável em Supabase
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
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

function InspecaoCanteiroPage() {
  const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const currentUserName = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || '' : ''
  const storageKey = `canteiro_inspecoes_${currentEnv}`

  // Data padrão: hoje + 7 dias
  const getDefaultDate = () => {
    const d = new Date(Date.now() + 7 * 864e5)
    return d.toISOString().slice(0, 10)
  }

  // Estados do cabeçalho
  const [dataInspecao, setDataInspecao] = useState(getDefaultDate())
  const [local, setLocal] = useState('Canteiro Central — Barcarena')
  const [responsavel, setResponsavel] = useState(currentUserName ? `${currentUserName} — Segurança / Encarregado` : 'Fabrício — Encarregado Geral')
  const [turno, setTurno] = useState('Manhã')
  const [area, setArea] = useState('Terraplenagem / Drenagem')

  // Rascunho dos itens da inspeção em criação
  const [items, setItems] = useState<DraftItem[]>([
    {
      id: 1,
      cat: 'Organização e limpeza',
      prio: 'Atenção — melhoria',
      titulo: '',
      obs: '',
      foto: '',
    },
  ])

  // Erros de validação
  const [invalidItemIds, setInvalidItemIds] = useState<number[]>([])
  const [feedback, setFeedback] = useState<{ msg: string; tipo: 'erro' | 'ok' } | null>(null)

  // Lista de inspeções salvas
  const [inspecoes, setInspecoes] = useState<InspecaoRegistro[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'corrigidos'>('todos')

  // Rascunho da correção por uid
  const [correcaoDraft, setCorrecaoDraft] = useState<Record<string, { foto?: string; texto?: string; erro?: string; info?: string }>>({})

  // Refs para rolagem
  const dateInputRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const pontosSectionRef = useRef<HTMLElement>(null)
  const relatorioSectionRef = useRef<HTMLElement>(null)

  // Carregar inspeções do Supabase / LocalStorage
  const carregarInspecoes = async () => {
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', storageKey)
        .single()

      if (!error && data?.value && Array.isArray(data.value)) {
        setInspecoes(data.value)
        try {
          localStorage.setItem(storageKey, JSON.stringify(data.value))
        } catch (_) {}
        return
      }
    } catch (err) {
      console.warn('Erro ao carregar do Supabase:', err)
    }

    // Fallback local
    try {
      const localData = localStorage.getItem(storageKey) || localStorage.getItem('hydro-inspecoes')
      if (localData) {
        setInspecoes(JSON.parse(localData))
      }
    } catch (_) {}
  }

  // Persistir inspeções
  const persistirInspecoes = async (novas: InspecaoRegistro[]) => {
    setInspecoes(novas)
    try {
      localStorage.setItem(storageKey, JSON.stringify(novas))
    } catch (_) {}

    try {
      await supabase.from('global_settings').upsert({
        key: storageKey,
        value: novas,
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Erro ao sincronizar com Supabase:', err)
    }
  }

  useEffect(() => {
    carregarInspecoes()

    // Realtime listener
    const channel = supabase
      .channel(`realtime_${storageKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_settings',
          filter: `key=eq.${storageKey}`,
        },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value)) {
            setInspecoes(payload.new.value)
            try {
              localStorage.setItem(storageKey, JSON.stringify(payload.new.value))
            } catch (_) {}
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storageKey])

  // Cálculo de prazo
  const calcularPrazo = () => {
    if (!dataInspecao) return { diasNum: '—', diasTxt: 'escolha a data acima', diff: null, textPrazo: '' }
    const d = new Date(dataInspecao + 'T12:00:00')
    const hoje = new Date()
    const hojeMeioDia = new Date(hoje.toISOString().slice(0, 10) + 'T12:00:00')
    const diff = Math.ceil((d.getTime() - hojeMeioDia.getTime()) / 864e5)
    const diasNum = diff < 0 ? 'Vencida' : diff === 0 ? 'Hoje' : `${diff} dia${diff > 1 ? 's' : ''}`
    const diasTxt = `Inspeção em ${d.toLocaleDateString('pt-BR')}`
    const textPrazo = `⏰ Prazo: até ${d.toLocaleDateString('pt-BR')} ${diff >= 0 ? `— faltam ${diff} dia(s)` : '— vencido'}`
    return { diasNum, diasTxt, diff, textPrazo, dataFormatada: d.toLocaleDateString('pt-BR') }
  }

  const prazoInfo = calcularPrazo()

  // Gerenciamento de itens de rascunho
  const adicionarItem = () => {
    const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1
    setItems((prev) => [
      ...prev,
      {
        id: nextId,
        cat: 'Organização e limpeza',
        prio: 'Atenção — melhoria',
        titulo: '',
        obs: '',
        foto: '',
      },
    ])
  }

  const removerItem = (id: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: Date.now(),
          cat: 'Organização e limpeza',
          prio: 'Atenção — melhoria',
          titulo: '',
          obs: '',
          foto: '',
        },
      ])
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
    setInvalidItemIds((prev) => prev.filter((iId) => iId !== id))
  }

  const updateItem = (id: number, field: keyof DraftItem, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
    if (field === 'titulo' || field === 'obs') {
      setInvalidItemIds((prev) => prev.filter((iId) => iId !== id))
    }
  }

  const handleFotoItem = async (e: React.ChangeEvent<HTMLInputElement>, id: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    const toastId = toast.loading('Processando foto...')
    try {
      const base64 = await compressImage(file)
      updateItem(id, 'foto', base64)
      toast.success('Foto adicionada!', { id: toastId })
    } catch (err) {
      toast.error('Erro ao processar foto', { id: toastId })
    } finally {
      e.target.value = ''
    }
  }

  // Validação e Salvamento da Inspeção
  const handleSalvarInspecao = () => {
    setFeedback(null)
    setInvalidItemIds([])

    // Validação de Data
    if (!dataInspecao) {
      setFeedback({
        tipo: 'erro',
        msg: '⚠️ FALTA A DATA DA INSPEÇÃO: escolha a data da inspeção do canteiro no campo “Data da inspeção do canteiro” e clique em Salvar inspeção de novo.',
      })
      if (dateInputRef.current) {
        dateInputRef.current.focus()
        dateInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    // Validação dos Itens
    const invalidos = items.filter((i) => !i.titulo.trim() || !i.obs.trim())
    if (invalidos.length > 0) {
      const idsInvalidos = invalidos.map((i) => i.id)
      setInvalidItemIds(idsInvalidos)
      setFeedback({
        tipo: 'erro',
        msg: `⚠️ AINDA NÃO SALVOU: preencha o TÍTULO DO ITEM e a OBSERVAÇÃO / O QUE PRECISA MELHORAR em ${
          invalidos.length > 1
            ? `os ${invalidos.length} itens destacados em vermelho`
            : 'o item destacado em vermelho'
        }. Depois clique em Salvar inspeção de novo.`,
      })

      // Rola até o primeiro inválido
      const el = document.getElementById(`item-card-${invalidos[0].id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    // Construção dos Pontos
    const timestamp = Date.now()
    const novosPontos: PontoInspecao[] = items.map((item, idx) => ({
      uid: `p${timestamp}-${idx}`,
      titulo: item.titulo.trim(),
      obs: item.obs.trim(),
      cat: item.cat,
      prio: item.prio,
      foto: item.foto || '',
      corrigido: false,
      fotoCorrecao: '',
      dataCorrecao: '',
      obsCorrecao: '',
    }))

    const novoRegistro: InspecaoRegistro = {
      data: dataInspecao,
      local: local.trim() || 'Canteiro Central — Barcarena',
      responsavel: responsavel.trim() || currentUserName || 'Fabrício — Encarregado Geral',
      turno,
      area: area.trim() || 'Terraplenagem / Drenagem',
      salvoEm: new Date().toLocaleString('pt-BR'),
      itens: novosPontos,
    }

    const novasInspecoes = [novoRegistro, ...inspecoes]
    persistirInspecoes(novasInspecoes)

    // Resetar formulário
    setItems([
      {
        id: Date.now(),
        cat: 'Organização e limpeza',
        prio: 'Atenção — melhoria',
        titulo: '',
        obs: '',
        foto: '',
      },
    ])
    setInvalidItemIds([])

    setFeedback({
      tipo: 'ok',
      msg: `✅ INSPEÇÃO SALVA! ${novosPontos.length} ponto(s) registrado(s) como ⏳ PENDENTE na lista “Pontos de Atenção para Melhoria” abaixo. Cada ponto só vira CORRIGIDO depois da foto da correção + o campo do que foi feito + Salvar correção.`,
    })

    toast.success(`✅ Inspeção salva — ${novosPontos.length} ponto(s) ⏳ PENDENTE`)

    setTimeout(() => {
      pontosSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 400)
  }

  const handleLimparFormulario = () => {
    if (confirm('Limpar o formulário atual?')) {
      setItems([
        {
          id: Date.now(),
          cat: 'Organização e limpeza',
          prio: 'Atenção — melhoria',
          titulo: '',
          obs: '',
          foto: '',
        },
      ])
      setInvalidItemIds([])
      setFeedback(null)
    }
  }

  // Foto da correção em rascunho
  const handleFotoCorrecao = async (e: React.ChangeEvent<HTMLInputElement>, uid: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const toastId = toast.loading('Processando foto da correção...')
    try {
      const base64 = await compressImage(file)
      setCorrecaoDraft((prev) => ({
        ...prev,
        [uid]: {
          ...prev[uid],
          foto: base64,
          erro: undefined,
          info: '📷 Foto da correção adicionada — mas o ponto AINDA ESTÁ ⏳ PENDENTE. Preencha “O que foi feito na correção?” e clique em 💾 Salvar correção para virar CORRIGIDO.',
        },
      }))
      toast.success('📷 Foto pronta — preencha o que foi feito e clique em Salvar correção', { id: toastId })
    } catch (err) {
      toast.error('Erro ao processar imagem', { id: toastId })
    } finally {
      e.target.value = ''
    }
  }

  const handleTextoCorrecao = (uid: string, text: string) => {
    setCorrecaoDraft((prev) => ({
      ...prev,
      [uid]: {
        ...prev[uid],
        texto: text,
        erro: undefined,
      },
    }))
  }

  // Salvar Correção (obriga foto + descrição)
  const handleSalvarCorrecao = (uid: string) => {
    const draft = correcaoDraft[uid] || {}
    const foto = draft.foto?.trim() || ''
    const texto = draft.texto?.trim() || ''

    const faltas: string[] = []
    if (!foto) faltas.push('enviar a FOTO DA CORREÇÃO')
    if (!texto) faltas.push('preencher O QUE FOI FEITO na correção')

    if (faltas.length > 0) {
      setCorrecaoDraft((prev) => ({
        ...prev,
        [uid]: {
          ...prev[uid],
          erro: `⚠️ AINDA ⏳ PENDENTE — falta: ${faltas.join(' + ')}. Complete e clique em 💾 Salvar correção de novo.`,
        },
      }))
      return
    }

    // Atualiza ponto
    let atualizou = false
    const novasInspecoes = inspecoes.map((reg) => ({
      ...reg,
      itens: reg.itens.map((ponto) => {
        if (ponto.uid === uid) {
          atualizou = true
          return {
            ...ponto,
            corrigido: true,
            fotoCorrecao: foto,
            obsCorrecao: texto,
            dataCorrecao: new Date().toLocaleString('pt-BR'),
          }
        }
        return ponto
      }),
    }))

    if (atualizou) {
      persistirInspecoes(novasInspecoes)
      setCorrecaoDraft((prev) => {
        const copy = { ...prev }
        delete copy[uid]
        return copy
      })
      toast.success('✅ Correção salva! Ponto CORRIGIDO — relatório atualizado')
    }
  }

  // Voltar para PENDENTE para reabrir
  const handleReabrirCorrecao = (uid: string) => {
    let fotoAntiga = ''
    let textoAntigo = ''

    const novasInspecoes = inspecoes.map((reg) => ({
      ...reg,
      itens: reg.itens.map((ponto) => {
        if (ponto.uid === uid) {
          fotoAntiga = ponto.fotoCorrecao || ''
          textoAntigo = ponto.obsCorrecao || ''
          return {
            ...ponto,
            corrigido: false,
            dataCorrecao: '',
          }
        }
        return ponto
      }),
    }))

    setCorrecaoDraft((prev) => ({
      ...prev,
      [uid]: {
        foto: fotoAntiga,
        texto: textoAntigo,
        info: '↩️ Ponto reaberto como PENDENTE. Edite e clique em Salvar correção.',
      },
    }))

    persistirInspecoes(novasInspecoes)
    toast.success('↩️ Ponto voltou para ⏳ PENDENTE — edite e clique em Salvar correção')
  }

  // Excluir ponto
  const handleExcluirPonto = (uid: string) => {
    if (!confirm('Excluir este ponto de atenção?')) return

    const novasInspecoes = inspecoes
      .map((reg) => ({
        ...reg,
        itens: reg.itens.filter((p) => p.uid !== uid),
      }))
      .filter((reg) => reg.itens.length > 0)

    persistirInspecoes(novasInspecoes)
    toast.success('Ponto excluído — relatório atualizado')
  }

  // Cálculos de relatório e lista
  const todosPontosComReg = inspecoes.flatMap((r) => r.itens.map((i) => ({ r, i })))
  const totalPontos = todosPontosComReg.length
  const corrigidosCount = todosPontosComReg.filter((x) => x.i.corrigido).length
  const pendentesCount = totalPontos - corrigidosCount
  const percentualConcluido = totalPontos > 0 ? Math.round((corrigidosCount / totalPontos) * 100) : 0

  // Filtro
  const pontosFiltrados = todosPontosComReg.filter((x) => {
    if (filtro === 'corrigidos') return x.i.corrigido
    if (filtro === 'pendentes') return !x.i.corrigido
    return true
  })

  // Copiar relatório
  const copiarRelatorio = () => {
    if (totalPontos === 0) {
      toast.error('Nenhum ponto registrado para copiar')
      return
    }

    let s = `RELATÓRIO AUTOMÁTICO — INSPEÇÃO DE CANTEIRO (Hydro Reabilitação)\n`
    s += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`
    s += `Resumo: ${totalPontos} ponto(s) de atenção • ${corrigidosCount} corrigido(s) • ${pendentesCount} pendente(s) • ${percentualConcluido}% concluído\n\n`

    todosPontosComReg.forEach(({ r, i }, idx) => {
      s += `${idx + 1}. ${i.titulo || 'Ponto de atenção'} [${i.corrigido ? 'CORRIGIDO' : 'PENDENTE'}]\n`
      s += `   Categoria: ${i.cat} • Prioridade: ${i.prio} • Prazo: ${r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}\n`
      s += `   Problema: ${i.obs || '—'}\n`
      if (i.obsCorrecao) s += `   Correção: ${i.obsCorrecao}\n`
      if (i.dataCorrecao) s += `   Corrigido em: ${i.dataCorrecao}\n`
      s += `   Foto do problema: ${i.foto ? 'anexada' : 'não anexada'} • Foto da correção: ${i.fotoCorrecao ? 'anexada' : 'não anexada'}\n\n`
    })

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(() => {
        toast.success('📋 Relatório copiado! Cole onde precisar (WhatsApp, e-mail, etc.)')
      })
    } else {
      prompt('Copie o relatório:', s)
    }
  }

  // Imprimir relatório
  const imprimirRelatorio = () => {
    const cab = inspecoes[0]
    const itensHtml = todosPontosComReg
      .map(
        ({ r, i }, n) => `
      <div style="border-top:1px solid #ccc;padding:12px 0;">
        <b style="font-size:16px;">${n + 1}. ${i.titulo || 'Ponto de atenção'}</b> — 
        <span style="font-weight:bold;color:${i.corrigido ? '#16a34a' : '#dc2626'}">${i.corrigido ? 'CORRIGIDO' : 'PENDENTE'}</span><br>
        <span style="color:#333;font-size:13px;">Categoria: ${i.cat} • Prioridade: ${i.prio} • Prazo: até ${r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span><br>
        <span style="color:#111;font-size:14px;"><b>Problema:</b> ${i.obs || '—'}</span><br>
        ${i.obsCorrecao ? `<span style="color:#111;font-size:14px;"><b>Correção realizada:</b> ${i.obsCorrecao}</span><br>` : ''}
        ${i.dataCorrecao ? `<span style="color:#4b5563;font-size:12px;">Data da correção: ${i.dataCorrecao}</span><br>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
          <div style="border:1px solid #ddd;padding:8px;border-radius:8px;">
            <b style="font-size:12px;display:block;margin-bottom:4px;">Antes (Problema)</b>
            ${i.foto ? `<img src="${i.foto}" style="width:100%;height:180px;object-fit:cover;border-radius:6px;" />` : '<div style="height:180px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:12px;">Sem foto</div>'}
          </div>
          <div style="border:1px solid #ddd;padding:8px;border-radius:8px;">
            <b style="font-size:12px;display:block;margin-bottom:4px;">Depois (Correção)</b>
            ${i.fotoCorrecao ? `<img src="${i.fotoCorrecao}" style="width:100%;height:180px;object-fit:cover;border-radius:6px;" />` : '<div style="height:180px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:12px;">Sem foto de correção</div>'}
          </div>
        </div>
      </div>
    `
      )
      .join('')

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório — Inspeção de Canteiro</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #111; padding: 24px; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          .summary { font-size: 14px; margin-bottom: 16px; color: #374151; }
        </style>
      </head>
      <body>
        <h1>Relatório Automático — Inspeção de Canteiro</h1>
        <p class="summary">Hydro Reabilitação • Gerado em ${new Date().toLocaleString('pt-BR')}<br>
        ${cab ? `Inspeção: <b>${cab.data ? new Date(cab.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</b> • Local: <b>${cab.local || 'Canteiro'}</b> • Responsável: <b>${cab.responsavel || '—'}</b> • Área: <b>${cab.area || '—'}</b><br>` : ''}
        Resumo: <b>${totalPontos} ponto(s)</b> • <b>${corrigidosCount} corrigido(s)</b> • <b>${pendentesCount} pendente(s)</b> — <b>${percentualConcluido}% concluído</b></p>
        ${itensHtml || '<p>Nenhum ponto registrado.</p>'}
        <script>
          window.onload = () => { window.print(); }
        </script>
      </body>
      </html>
    `

    const win = window.open('', '_blank')
    if (!win) {
      alert('Permita pop-ups no navegador para imprimir o relatório.')
      return
    }
    win.document.write(printHtml)
    win.document.close()
  }

  return (
    <div className="inspecao-canteiro-root min-h-screen pb-24 text-[#111827] bg-[#f8fafc] dark:bg-[#0b0f17]">
      {/* Estilos CSS Scoped para garantir tipografia e regras de alta legibilidade */}
      <style>{`
        .inspecao-canteiro-root label {
          font-size: 13px !important;
          font-weight: 900 !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase !important;
          color: #000000 !important;
          display: block !important;
          margin: 14px 0 6px !important;
        }
        .inspecao-canteiro-root input,
        .inspecao-canteiro-root select,
        .inspecao-canteiro-root textarea {
          width: 100% !important;
          border: 1.5px solid #9ca3af !important;
          border-radius: 12px !important;
          padding: 12px 13px !important;
          font-size: 14px !important;
          font-family: inherit !important;
          outline: 0 !important;
          background: #ffffff !important;
          color: #111827 !important;
          font-weight: 600 !important;
        }
        .inspecao-canteiro-root textarea {
          resize: vertical !important;
          min-height: 86px !important;
        }
        .inspecao-canteiro-root input:focus,
        .inspecao-canteiro-root select:focus,
        .inspecao-canteiro-root textarea:focus {
          border-color: #f5c518 !important;
          box-shadow: 0 0 0 3px #fef3c7 !important;
        }
        .inspecao-canteiro-root input::placeholder,
        .inspecao-canteiro-root textarea::placeholder {
          color: #374151 !important;
          opacity: 1 !important;
          font-weight: 500 !important;
        }
        .inspecao-canteiro-root select option {
          color: #111827 !important;
          background: #ffffff !important;
          font-weight: 600 !important;
        }
        .inspecao-canteiro-root input[type="date"] {
          color: #111827 !important;
          font-weight: 700 !important;
        }
        .inspecao-canteiro-root .hint-text {
          color: #111827 !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          line-height: 1.55 !important;
        }
        .inspecao-canteiro-root .photo-box-drop {
          border: 2px dashed #6b7280;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
          background: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .inspecao-canteiro-root .photo-box-drop:hover {
          border-color: #f5c518;
          background: #fffbeb;
        }
        .inspecao-canteiro-root .photo-box-text {
          color: #000000 !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          line-height: 1.55 !important;
        }
        .inspecao-canteiro-root .photo-box-text b {
          color: #000000 !important;
          font-weight: 900 !important;
        }
        .inspecao-canteiro-root .ponto-item-card {
          border: 2px solid #fde68a;
          border-left: 8px solid #f59e0b;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 14px;
          background: #fffbeb;
        }
        .inspecao-canteiro-root .ponto-item-card.done {
          border-color: #bbf7d0 !important;
          border-left-color: #16a34a !important;
          background: #f0fdf4 !important;
        }
        .inspecao-canteiro-root .btn-salvar-correcao {
          background: #16a34a;
          color: #ffffff;
          border: 0;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 900;
          font-size: 15px;
          margin-top: 12px;
          width: 100%;
          cursor: pointer;
          transition: background 0.2s;
        }
        .inspecao-canteiro-root .btn-salvar-correcao:hover {
          background: #15803d;
        }
        .inspecao-canteiro-root .invalid-field {
          border: 2.5px solid #dc2626 !important;
          background: #fef2f2 !important;
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <Link to="/seguranca" className="hover:underline font-semibold text-gray-700 dark:text-gray-300">
            Segurança
          </Link>
          <span>›</span>
          <b className="text-black dark:text-white font-extrabold">Inspeção de Canteiro</b>
        </div>

        {/* Título e Subtítulo */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">
          🏗️ Inspeção de Canteiro
        </h1>
        <p className="text-gray-700 dark:text-gray-300 max-w-3xl leading-relaxed mb-6 font-medium text-sm sm:text-base">
          Cadastre a data da próxima inspeção e registre os itens de observação encontrados no canteiro — com foto —
          marcados como <b>atenção para melhoria</b>. Tudo precisa ser corrigido <b>até a data da inspeção</b>.
        </p>

        {/* Grid Superior: Dados da Inspeção + Como Funciona */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Coluna Esquerda: Formulário do Cabeçalho */}
          <section className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
              📅 Dados da inspeção
            </h2>
            <p className="hint-text mb-4">
              Defina quando será a inspeção. Essa data vira o prazo final de todos os itens abaixo.
            </p>

            <label htmlFor="dataInspecaoInput">Data da inspeção do canteiro *</label>
            <input
              ref={dateInputRef}
              id="dataInspecaoInput"
              type="date"
              value={dataInspecao}
              onChange={(e) => setDataInspecao(e.target.value)}
              className="mb-3"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="localInput">Local / Frente de obra</label>
                <input
                  id="localInput"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex.: Canteiro Central — Barcarena"
                />
              </div>
              <div>
                <label htmlFor="responsavelInput">Responsável / Inspetor</label>
                <input
                  id="responsavelInput"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="Ex.: Fabrício — Encarregado Geral"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div>
                <label htmlFor="turnoSelect">Turno</label>
                <select
                  id="turnoSelect"
                  value={turno}
                  onChange={(e) => setTurno(e.target.value)}
                >
                  {TURNOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="areaInput">Área inspecionada</label>
                <input
                  id="areaInput"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Ex.: Terraplenagem / Drenagem"
                />
              </div>
            </div>

            {/* Countdown Box */}
            <div className="mt-5 bg-[#111827] text-white rounded-2xl p-4 flex justify-between items-center shadow-inner">
              <div>
                <span className="text-xs text-gray-400 block tracking-wider uppercase font-bold">
                  PRAZO PARA CORREÇÃO
                </span>
                <span className="text-sm font-semibold text-gray-200">Até a data da inspeção</span>
              </div>
              <div className="text-right">
                <strong className="text-2xl sm:text-3xl font-extrabold text-[#f5c518] block leading-tight">
                  {prazoInfo.diasNum}
                </strong>
                <span className="text-xs text-gray-300 block">{prazoInfo.diasTxt}</span>
              </div>
            </div>

            {/* Stats do Cabeçalho */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                <b className="text-2xl font-black text-gray-900 dark:text-white block">{items.length}</b>
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Itens
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                <b className="text-2xl font-black text-gray-900 dark:text-white block">
                  {items.filter((i) => Boolean(i.foto)).length}
                </b>
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Com foto
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                <b className="text-2xl font-black text-[#dc2626] block">{items.length}</b>
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Pendentes
                </span>
              </div>
            </div>
          </section>

          {/* Coluna Direita: Alerta + Como Funciona */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#fffbeb] border border-[#fde68a] border-l-[6px] border-l-[#f59e0b] rounded-2xl p-4 flex gap-3 shadow-sm">
              <div className="text-2xl flex-shrink-0">⚠️</div>
              <div>
                <b className="text-[#92400e] text-base block font-black">Atenção para melhoria</b>
                <p className="text-xs sm:text-sm text-[#78350f] mt-1 leading-relaxed font-semibold">
                  Foto ajuda a fiscalização a ver exatamente o que precisa ser corrigido. Tire a foto do local, descreva o
                  problema e deixe registrado antes da inspeção chegar.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex-1">
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">Como funciona</h2>
              <p className="hint-text text-xs sm:text-sm leading-relaxed space-y-1">
                1. Escolha a <b>data da inspeção</b>.<br />
                2. Clique em <b>+ Adicionar item</b> para cada observação.<br />
                3. Escreva a observação, escolha a categoria e <b>anexe a foto</b>.<br />
                4. Clique em <b>Salvar inspeção</b> — cada item vira um <b>Ponto de Atenção para Melhoria</b> na lista abaixo,
                mostrando <b>⏳ PENDENTE</b>.<br />
                5. Ele <b>continua PENDENTE</b> até você, no próprio ponto: <b>enviar a foto da correção</b>,{' '}
                <b>preencher “O que foi feito na correção?”</b> e clicar em <b>💾 Salvar correção</b>. Só aí ele vira{' '}
                <b>✅ CORRIGIDO</b>.<br />
                6. O <b>relatório completo é gerado automaticamente</b> no final da página, com antes e depois.
              </p>
            </div>
          </section>
        </div>

        {/* Seção dos Itens de Observação */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4 mt-6">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            📝 Itens de observação
          </h2>
          <button
            type="button"
            onClick={adicionarItem}
            className="bg-[#f5c518] hover:bg-[#e0b414] text-black font-extrabold px-5 py-3 rounded-xl shadow-sm transition-transform active:scale-95 text-sm"
          >
            + Adicionar item de observação
          </button>
        </div>

        {/* Lista de Itens do Formulário */}
        <div className="space-y-4 mb-6">
          {items.map((item, index) => {
            const isInvalid = invalidItemIds.includes(item.id)
            return (
              <div
                key={item.id}
                id={`item-card-${item.id}`}
                className={`bg-white dark:bg-gray-900 rounded-2xl p-5 border transition-all ${
                  isInvalid ? 'border-2 border-[#dc2626] bg-[#fef2f2]' : 'border-gray-200 dark:border-gray-800 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center gap-2 flex-wrap pb-3 border-b border-gray-100 dark:border-gray-800 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-[#fef3c7] text-[#92400e] font-black text-xs px-3 py-1.5 rounded-full uppercase tracking-wider">
                      ⚠️ ATENÇÃO PARA MELHORIA
                    </span>
                    <span className="text-xs text-[#92400e] font-extrabold">
                      {prazoInfo.textPrazo}
                    </span>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="text-xs bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2] border border-[#fecaca] px-3 py-1.5 rounded-lg font-extrabold transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label>Categoria</label>
                    <select
                      value={item.cat}
                      onChange={(e) => updateItem(item.id, 'cat', e.target.value)}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Prioridade</label>
                    <select
                      value={item.prio}
                      onChange={(e) => updateItem(item.id, 'prio', e.target.value)}
                    >
                      {PRIORIDADES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label>Título do item *</label>
                <input
                  value={item.titulo}
                  onChange={(e) => updateItem(item.id, 'titulo', e.target.value)}
                  placeholder="Ex.: Material espalhado na área de circulação"
                  className={isInvalid && !item.titulo.trim() ? 'invalid-field' : ''}
                />

                <label>Observação / o que precisa melhorar *</label>
                <textarea
                  value={item.obs}
                  onChange={(e) => updateItem(item.id, 'obs', e.target.value)}
                  placeholder="Descreva o que foi encontrado, onde está e o que precisa ser feito até a inspeção..."
                  className={isInvalid && !item.obs.trim() ? 'invalid-field' : ''}
                />

                <label>Foto do local (atenção para melhoria)</label>
                <label className="photo-box-drop block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFotoItem(e, item.id)}
                  />
                  {item.foto ? (
                    <div className="relative group">
                      <img
                        src={item.foto}
                        alt="Foto do item"
                        className="w-full max-h-[220px] object-cover rounded-xl"
                      />
                      <div className="mt-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                        Clique para substituir a foto
                      </div>
                    </div>
                  ) : (
                    <div className="photo-box-text py-4">
                      📷 <b>Clique para tirar foto ou anexar imagem</b>
                      <br />
                      A foto aparece aqui na hora para conferência.
                    </div>
                  )}
                </label>
              </div>
            )
          })}
        </div>

        {/* Botões de Ação do Formulário */}
        <div className="flex gap-3 flex-wrap items-center mt-2 mb-4">
          <button
            type="button"
            onClick={handleSalvarInspecao}
            className="bg-[#111827] hover:bg-black text-white font-extrabold px-6 py-3.5 rounded-xl text-base shadow-sm transition-transform active:scale-95"
          >
            💾 Salvar inspeção
          </button>
          <button
            type="button"
            onClick={handleLimparFormulario}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 font-extrabold px-5 py-3.5 rounded-xl text-base hover:bg-gray-50 transition-colors"
          >
            Limpar formulário
          </button>
        </div>

        {/* Mensagem de Feedback Inline (Vermelha / Verde) */}
        {feedback && (
          <div
            ref={feedbackRef}
            role="alert"
            className={`rounded-2xl p-4 font-bold text-sm sm:text-base leading-relaxed mb-8 shadow-sm ${
              feedback.tipo === 'erro'
                ? 'bg-[#fef2f2] border-2 border-[#dc2626] text-[#991b1b]'
                : 'bg-[#f0fdf4] border-2 border-[#16a34a] text-[#14532d]'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* SEÇÃO: PONTOS DE ATENÇÃO PARA MELHORIA */}
        <section ref={pontosSectionRef} className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              ⚠️ Pontos de Atenção para Melhoria
            </h2>
            <span className="text-xs sm:text-sm font-extrabold text-black dark:text-white">
              {totalPontos > 0
                ? `${totalPontos} ponto(s) registrado(s) • ${corrigidosCount} corrigido(s) • ${pendentesCount} pendente(s)`
                : 'Nenhum ponto registrado ainda'}
            </span>
          </div>

          <p className="text-sm font-medium text-gray-800 dark:text-gray-300 mb-4 leading-relaxed">
            Depois de salvar, cada item fica registrado aqui como <b>ponto de atenção para melhoria</b>, mostrando{' '}
            <b>⏳ PENDENTE</b>. O ponto <b>só sai de PENDENTE</b> quando você, nele mesmo: <b>1)</b> enviar a{' '}
            <b>foto da correção</b>, <b>2)</b> preencher o campo <b>“O que foi feito na correção?”</b> e <b>3)</b> clicar
            em <b>💾 Salvar correção</b>. Aí ele vira <b>✅ CORRIGIDO</b> e o relatório abaixo é atualizado automaticamente.
          </p>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              type="button"
              onClick={() => setFiltro('todos')}
              className={`px-4 py-2 rounded-full font-extrabold text-sm border-2 transition-colors ${
                filtro === 'todos'
                  ? 'bg-[#111827] text-white border-[#111827]'
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 hover:border-black'
              }`}
            >
              Todos ({totalPontos})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('pendentes')}
              className={`px-4 py-2 rounded-full font-extrabold text-sm border-2 transition-colors ${
                filtro === 'pendentes'
                  ? 'bg-[#dc2626] text-white border-[#dc2626]'
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 hover:border-black'
              }`}
            >
              Pendentes ({pendentesCount})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('corrigidos')}
              className={`px-4 py-2 rounded-full font-extrabold text-sm border-2 transition-colors ${
                filtro === 'corrigidos'
                  ? 'bg-[#16a34a] text-white border-[#16a34a]'
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 hover:border-black'
              }`}
            >
              Corrigidos ({corrigidosCount})
            </button>
          </div>

          {/* Lista de Pontos Salvos */}
          {pontosFiltrados.length === 0 ? (
            <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center text-gray-500 font-semibold text-sm">
              {totalPontos === 0 ? (
                <>
                  Nenhum ponto registrado ainda.
                  <br />
                  Adicione um item acima, anexe a foto e clique em Salvar inspeção.
                </>
              ) : (
                'Nenhum ponto neste filtro.'
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {pontosFiltrados.map(({ r, i }) => {
                const draft = correcaoDraft[i.uid] || {}
                const fotoDepois = i.corrigido ? i.fotoCorrecao : draft.foto || ''
                const textoCorr = i.corrigido
                  ? i.obsCorrecao || ''
                  : draft.texto !== undefined
                  ? draft.texto
                  : i.obsCorrecao || ''

                return (
                  <div
                    key={i.uid}
                    data-uid={i.uid}
                    className={`ponto-item-card ${i.corrigido ? 'done' : ''}`}
                  >
                    {/* Cabeçalho do Card */}
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-black text-black">{i.titulo || 'Ponto de atenção'}</h3>
                          <span
                            className={`font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider ${
                              i.corrigido
                                ? 'bg-[#dcfce7] text-[#166534]'
                                : 'bg-[#fee2e2] text-[#991b1b]'
                            }`}
                          >
                            {i.corrigido ? '✅ CORRIGIDO' : '⏳ PENDENTE'}
                          </span>
                          <span
                            className={`font-black text-xs px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              i.prio?.includes('Alta')
                                ? 'bg-[#fee2e2] text-[#991b1b]'
                                : 'bg-[#fef3c7] text-[#92400e]'
                            }`}
                          >
                            {i.prio}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 leading-relaxed">{i.obs}</p>
                        <div className="text-xs text-gray-900 font-bold mt-2">
                          📂 {i.cat} &nbsp;•&nbsp; 📅 Inspeção:{' '}
                          {r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} &nbsp;•&nbsp; 📍{' '}
                          {r.local || 'Canteiro'} &nbsp;•&nbsp; Registrado em {r.salvoEm}
                          {i.dataCorrecao && (
                            <>
                              <br />
                              <span className="text-[#166534]">✅ Correção salva em {i.dataCorrecao}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExcluirPonto(i.uid)}
                        className="text-xs bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2] border border-[#fecaca] px-3 py-1.5 rounded-lg font-extrabold transition-colors"
                      >
                        Excluir
                      </button>
                    </div>

                    {/* Conteúdo dependendo se está CORRIGIDO ou PENDENTE */}
                    {i.corrigido ? (
                      <div className="mt-3">
                        <div className="bg-[#f0fdf4] border border-[#86efac] rounded-xl p-3 text-sm font-bold text-[#14532d] mb-3">
                          ✅ <b>Correção salva</b> {i.dataCorrecao ? `em ${i.dataCorrecao}` : ''} — este ponto já entrou
                          como CORRIGIDO no relatório abaixo.
                        </div>

                        {/* Comparativo Fotos Antes / Depois */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <div className="bg-white border border-[#9ca3af] rounded-xl p-3">
                            <b className="text-xs uppercase tracking-wider text-black block mb-2 font-extrabold">
                              📷 Antes — foto do problema
                            </b>
                            {i.foto ? (
                              <img
                                src={i.foto}
                                alt="Foto do problema"
                                className="w-full h-[180px] object-cover rounded-lg bg-gray-100"
                              />
                            ) : (
                              <div className="h-[180px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-600 font-bold text-xs">
                                Sem foto do problema
                              </div>
                            )}
                          </div>
                          <div className="bg-white border border-[#9ca3af] rounded-xl p-3">
                            <b className="text-xs uppercase tracking-wider text-black block mb-2 font-extrabold">
                              ✅ Depois — foto da correção
                            </b>
                            {i.fotoCorrecao ? (
                              <img
                                src={i.fotoCorrecao}
                                alt="Foto da correção"
                                className="w-full h-[180px] object-cover rounded-lg bg-gray-100"
                              />
                            ) : (
                              <div className="h-[180px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-600 font-bold text-xs">
                                Sem foto da correção
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 text-sm font-semibold text-gray-900">
                          <b>O que foi feito na correção:</b> {i.obsCorrecao || '—'}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReabrirCorrecao(i.uid)}
                          className="mt-3 bg-white text-gray-900 border border-gray-400 font-extrabold px-4 py-2 rounded-xl text-xs sm:text-sm hover:bg-gray-100 transition-colors"
                        >
                          ↩️ Voltar para PENDENTE para editar a correção
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-xl p-3 text-xs sm:text-sm font-bold text-[#991b1b] mb-3">
                          ⏳ Este ponto fica <b>PENDENTE</b> até você: <b>1)</b> enviar a foto da correção, <b>2)</b> preencher
                          “O que foi feito na correção?” e <b>3)</b> clicar em <b>💾 Salvar correção</b> aqui embaixo.
                        </div>

                        {/* Comparativo Fotos Antes / Depois */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <div className="bg-white border border-[#9ca3af] rounded-xl p-3">
                            <b className="text-xs uppercase tracking-wider text-black block mb-2 font-extrabold">
                              📷 Antes — foto do problema
                            </b>
                            {i.foto ? (
                              <img
                                src={i.foto}
                                alt="Foto do problema"
                                className="w-full h-[180px] object-cover rounded-lg bg-gray-100"
                              />
                            ) : (
                              <div className="h-[180px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-600 font-bold text-xs">
                                Sem foto do problema
                              </div>
                            )}
                          </div>

                          <div className="bg-white border border-[#9ca3af] rounded-xl p-3">
                            <b className="text-xs uppercase tracking-wider text-black block mb-2 font-extrabold">
                              ✅ Depois — foto da correção *
                            </b>
                            {fotoDepois ? (
                              <img
                                src={fotoDepois}
                                alt="Prévia da foto da correção"
                                className="w-full h-[180px] object-cover rounded-lg bg-gray-100 mb-2"
                              />
                            ) : (
                              <div className="h-[140px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-600 font-bold text-xs mb-2">
                                Nenhuma foto da correção ainda
                              </div>
                            )}

                            <label className="photo-box-drop block">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handleFotoCorrecao(e, i.uid)}
                              />
                              <div className="photo-box-text py-1 text-xs">
                                📷 <b>Clique para enviar a foto da correção</b>
                                <br />
                                Ela aparece aqui na hora, mas o ponto continua PENDENTE até salvar a correção.
                              </div>
                            </label>
                          </div>
                        </div>

                        <label>O que foi feito na correção? *</label>
                        <textarea
                          value={textoCorr}
                          onChange={(e) => handleTextoCorrecao(i.uid, e.target.value)}
                          placeholder="Descreva o que foi feito para corrigir este ponto. Ex.: Material recolhido, área isolada e sinalizada..."
                          className={draft.erro && !textoCorr.trim() ? 'invalid-field' : ''}
                        />

                        {/* Mensagens de feedback específicas da correção */}
                        {draft.erro && (
                          <div className="mt-2 bg-[#fef2f2] border-2 border-[#dc2626] text-[#991b1b] rounded-xl p-3 text-xs sm:text-sm font-bold">
                            {draft.erro}
                          </div>
                        )}
                        {draft.info && (
                          <div className="mt-2 bg-[#fffbeb] border-2 border-[#f59e0b] text-[#92400e] rounded-xl p-3 text-xs sm:text-sm font-bold">
                            {draft.info}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSalvarCorrecao(i.uid)}
                          className="btn-salvar-correcao"
                        >
                          💾 Salvar correção
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* SEÇÃO: RELATÓRIO AUTOMÁTICO */}
        <section
          ref={relatorioSectionRef}
          id="relatorioSection"
          className="mt-12 bg-white dark:bg-gray-900 border-2 border-[#111827] rounded-3xl p-5 sm:p-7 shadow-lg"
        >
          <h2 className="text-2xl sm:text-3xl font-black text-black dark:text-white mb-1">
            📋 Relatório Automático da Inspeção
          </h2>
          <p className="hint-text text-xs sm:text-sm mb-4">
            Gerado automaticamente a partir dos pontos de atenção: toda vez que você marca um item como corrigido ou
            envia a foto da correção, este relatório é atualizado na hora — sem precisar preencher de novo.
          </p>

          {/* Stats do Relatório */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <b className="text-3xl font-black text-black dark:text-white block">{totalPontos}</b>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Total de pontos
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <b className="text-3xl font-black text-[#dc2626] block">{pendentesCount}</b>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Pendentes
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <b className="text-3xl font-black text-[#16a34a] block">{corrigidosCount}</b>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Corrigidos
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center border border-gray-200 dark:border-gray-700">
              <b className="text-3xl font-black text-black dark:text-white block">{percentualConcluido}%</b>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Concluído
              </span>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden my-4">
            <div
              className="h-full bg-[#16a34a] transition-all duration-500"
              style={{ width: `${percentualConcluido}%` }}
            />
          </div>

          {/* Conteúdo do Relatório */}
          {totalPontos === 0 ? (
            <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center text-gray-500 font-semibold text-sm">
              O relatório aparece aqui automaticamente assim que houver pontos salvos.
            </div>
          ) : (
            <div>
              {inspecoes[0] && (
                <p className="text-sm font-semibold text-black dark:text-gray-200 leading-relaxed mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                  Inspeção:{' '}
                  <b>
                    {inspecoes[0].data
                      ? new Date(inspecoes[0].data + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </b>{' '}
                  &nbsp;•&nbsp; Local: <b>{inspecoes[0].local || 'Canteiro'}</b> &nbsp;•&nbsp; Responsável/Inspetor:{' '}
                  <b>{inspecoes[0].responsavel || '—'}</b> &nbsp;•&nbsp; Área: <b>{inspecoes[0].area || '—'}</b>
                  <br />
                  Resumo automático: <b>{totalPontos} ponto(s)</b> de atenção para melhoria,{' '}
                  <b className="text-[#16a34a]">{corrigidosCount} corrigido(s)</b> e{' '}
                  <b className="text-[#dc2626]">{pendentesCount} pendente(s)</b> —{' '}
                  <b>{percentualConcluido}% concluído</b>.
                </p>
              )}

              <div className="space-y-4">
                {todosPontosComReg.map(({ r, i }, idx) => (
                  <div
                    key={i.uid || idx}
                    className="border-t border-gray-200 dark:border-gray-800 pt-3 pb-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <b className="text-base text-black dark:text-white">
                        {idx + 1}. {i.titulo || 'Ponto de atenção'}
                      </b>
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          i.corrigido ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'
                        }`}
                      >
                        {i.corrigido ? 'CORRIGIDO' : 'PENDENTE'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-800 dark:text-gray-300 font-semibold space-y-0.5">
                      <div>
                        Categoria: {i.cat} • Prioridade: {i.prio} • Prazo: até{' '}
                        {r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </div>
                      <div>
                        <b>Problema:</b> {i.obs || '—'}
                      </div>
                      {i.obsCorrecao && (
                        <div className="text-[#166534]">
                          <b>Correção:</b> {i.obsCorrecao}
                        </div>
                      )}
                      {i.dataCorrecao && (
                        <div className="text-gray-600 dark:text-gray-400">
                          <b>Corrigido em:</b> {i.dataCorrecao}
                        </div>
                      )}
                    </div>

                    {/* Comparativo Antes / Depois no Relatório */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5">
                        <b className="text-xs uppercase tracking-wider text-black dark:text-white block mb-1 font-bold">
                          Antes
                        </b>
                        {i.foto ? (
                          <img
                            src={i.foto}
                            alt="Antes"
                            className="w-full h-[160px] object-cover rounded-lg bg-gray-200"
                          />
                        ) : (
                          <div className="h-[160px] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 text-xs font-bold">
                            Sem foto
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5">
                        <b className="text-xs uppercase tracking-wider text-black dark:text-white block mb-1 font-bold">
                          Depois — correção
                        </b>
                        {i.fotoCorrecao ? (
                          <img
                            src={i.fotoCorrecao}
                            alt="Depois"
                            className="w-full h-[160px] object-cover rounded-lg bg-gray-200"
                          />
                        ) : (
                          <div className="h-[160px] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 text-xs font-bold">
                            Sem foto da correção
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botões do Relatório */}
          <div className="flex gap-3 flex-wrap mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={imprimirRelatorio}
              className="bg-[#111827] hover:bg-black text-white font-extrabold px-5 py-3 rounded-xl text-sm shadow-sm transition-transform active:scale-95"
            >
              🖨️ Imprimir / Salvar relatório em PDF
            </button>
            <button
              type="button"
              onClick={copiarRelatorio}
              className="bg-[#f5c518] hover:bg-[#e0b414] text-black font-extrabold px-5 py-3 rounded-xl text-sm shadow-sm transition-transform active:scale-95"
            >
              📋 Copiar relatório (texto)
            </button>
            <button
              type="button"
              onClick={() => relatorioSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 font-extrabold px-4 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              Ver topo do relatório
            </button>
          </div>
        </section>

        {/* Rodapé informativo */}
        <footer className="text-center text-xs text-gray-500 mt-10 leading-relaxed">
          Hydro Reabilitação — Inspeção de Canteiro • Os pontos, as fotos de antes/depois e o relatório ficam salvos
          no banco de dados do projeto.
        </footer>
      </div>
    </div>
  )
}
