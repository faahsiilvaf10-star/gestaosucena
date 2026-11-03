import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import {
  Search,
  X,
  Loader2,
  Users,
  Truck,
  Package,
  FileText,
  Shield,
  ArrowRight,
  Sparkles,
  ExternalLink,
  CornerDownLeft,
  Calendar,
  AlertTriangle,
  FolderOpen,
  Settings,
  Flame,
  Coffee,
  CheckCircle2,
  HardHat,
  Bookmark,
  Camera,
  Layers,
} from 'lucide-react'

export interface SearchResultItem {
  id: string
  title: string
  subtitle?: string
  category: 'modulo' | 'colaborador' | 'equipamento' | 'almoxarifado' | 'documento' | 'seguranca'
  href: string
  icon?: React.ReactNode
  badge?: string
}

interface SystemModule {
  title: string
  subtitle: string
  href: string
  keywords: string[]
  icon: React.ReactNode
  badge: string
}

const SYSTEM_MODULES: SystemModule[] = [
  {
    title: 'Painel Principal / Destaques',
    subtitle: 'Visão geral da operação e destaques do dia',
    href: '/dashboard',
    keywords: ['dashboard', 'destaques', 'inicio', 'home', 'painel', 'resumo', 'indicadores'],
    icon: <Sparkles size={16} className="text-yellow-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Almoxarifado & Estoque',
    subtitle: 'Gestão de materiais, EPIs, ferramentas e produtos',
    href: '/almoxarifado/estoque',
    keywords: ['almoxarifado', 'estoque', 'produtos', 'materiais', 'saldo', 'itens', 'ferramentas'],
    icon: <Package size={16} className="text-emerald-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Requisição Rápida de EPI',
    subtitle: 'Solicitação e troca de equipamentos de proteção',
    href: '/almoxarifado/requisicoes/nova',
    keywords: ['requisicao', 'epi', 'troca de epi', 'bota', 'luva', 'capacete', 'oculos', 'uniforme'],
    icon: <HardHat size={16} className="text-amber-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Equipamentos & Frota',
    subtitle: 'Controle de caminhões, máquinas, checklists e vistorias',
    href: '/equipamentos',
    keywords: ['equipamentos', 'caminhao', 'frota', 'maquinas', 'pipa', 'trator', 'vistorias', 'laudos'],
    icon: <Truck size={16} className="text-orange-500" />,
    badge: 'Módulo',
  },
  {
    title: 'App Motorista',
    subtitle: 'Início e fim de jornada, KM, horímetro e anomalias',
    href: '/equipamentos/app-motorista',
    keywords: ['motorista', 'app motorista', 'jornada', 'km', 'horimetro', 'anomalias', 'abastecimento'],
    icon: <Truck size={16} className="text-amber-400" />,
    badge: 'Módulo',
  },
  {
    title: 'Recursos Humanos (RH)',
    subtitle: 'Quadro de efetivo, colaboradores, matrículas e presenças',
    href: '/rh',
    keywords: ['rh', 'recursos humanos', 'colaboradores', 'funcionarios', 'efetivo', 'admissao', 'cargos'],
    icon: <Users size={16} className="text-sky-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Relatório Diário de Presença',
    subtitle: 'Lista de presença por área e turno de trabalho',
    href: '/rh/relatorio-presenca',
    keywords: ['presenca', 'frequencia', 'relatorio de presenca', 'faltas', 'diario'],
    icon: <Users size={16} className="text-blue-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Segurança do Trabalho (SST)',
    subtitle: 'Central de segurança, formulários, normas e rotinas',
    href: '/seguranca',
    keywords: ['seguranca', 'sst', 'sesmt', 'tst', 'normas', 'cipa'],
    icon: <Shield size={16} className="text-emerald-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Diálogo Diário de Segurança (DDS)',
    subtitle: 'Temas, agendamentos, palestrantes e listas de DDS',
    href: '/seguranca/dds',
    keywords: ['dds', 'dialogo diario de seguranca', 'palestra', 'tema dds', 'palestrante'],
    icon: <Coffee size={16} className="text-yellow-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Relato de Desvios de Segurança',
    subtitle: 'Registro de desvios comportamentais e estruturais',
    href: '/seguranca/desvios',
    keywords: ['desvios', 'desvio', 'quase acidente', 'risco', 'seguranca desvios', 'relato'],
    icon: <AlertTriangle size={16} className="text-rose-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Análise Preliminar de Risco (APR)',
    subtitle: 'Emissão e controle de validade de análises de risco',
    href: '/seguranca/analise-risco',
    keywords: ['analise de risco', 'apr', 'risco', 'atividade', 'validade apr', 'seguranca'],
    icon: <Shield size={16} className="text-amber-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Inspeção de Canteiro de Obras',
    subtitle: 'Auditorias programadas, checklist de itens e pontuação',
    href: '/seguranca/inspecao-canteiro',
    keywords: ['inspecao canteiro', 'auditoria', 'canteiro', 'pontos', 'conformidade'],
    icon: <CheckCircle2 size={16} className="text-teal-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Inspeção Mensal de Cintas',
    subtitle: 'Controle de cintas de içamento e código de cores',
    href: '/seguranca/cintas',
    keywords: ['cintas', 'icamento', 'inspecao de cintas', 'cor do mes', 'amarracao'],
    icon: <Layers size={16} className="text-indigo-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Controle de ASO (Saúde Ocupacional)',
    subtitle: 'Acompanhamento de vencimentos e renovação de ASOs',
    href: '/seguranca/controle-aso',
    keywords: ['aso', 'saude', 'medico', 'exames', 'periodico', 'admissional', 'vencimento aso'],
    icon: <FileText size={16} className="text-rose-400" />,
    badge: 'Módulo',
  },
  {
    title: 'Documentos & Procedimentos',
    subtitle: 'Biblioteca de documentos por cargo e procedimentos operacionais',
    href: '/documentos',
    keywords: ['documentos', 'arquivos', 'pasta', 'procedimentos', 'normas', 'manuais', 'pdf'],
    icon: <FolderOpen size={16} className="text-purple-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Relatório Diário de Obra (RDO)',
    subtitle: 'Registro de atividades, clima, mão de obra e equipamentos',
    href: '/relatorio-obra',
    keywords: ['rdo', 'relatorio de obra', 'diario de obra', 'obra', 'planejamento', 'avanco'],
    icon: <Calendar size={16} className="text-blue-400" />,
    badge: 'Módulo',
  },
  {
    title: 'Instacena (Rede Social da Obra)',
    subtitle: 'Feed de fotos, conquistas, stories e comentários da equipe',
    href: '/instacena',
    keywords: ['instacena', 'social', 'feed', 'fotos', 'stories', 'publicacao', 'curtidas'],
    icon: <Camera size={16} className="text-pink-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Lembretes & Compromissos',
    subtitle: 'Lembretes automáticos com avisos no WhatsApp',
    href: '/lembretes',
    keywords: ['lembretes', 'compromissos', 'avisos', 'tarefas', 'agenda'],
    icon: <Bookmark size={16} className="text-amber-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Meio Ambiente & Sustentabilidade',
    subtitle: 'Controle de resíduos, água, efluentes e pluviosidade',
    href: '/meio-ambiente',
    keywords: ['meio ambiente', 'residuos', 'agua', 'efluentes', 'pluviometria', 'sustentabilidade'],
    icon: <Sparkles size={16} className="text-green-500" />,
    badge: 'Módulo',
  },
  {
    title: 'Painel Administrativo & WhatsApp',
    subtitle: 'Configurações do sistema, envio automático de WhatsApp e usuários',
    href: '/admin',
    keywords: ['admin', 'administracao', 'configuracoes', 'whatsapp', 'mensagens', 'parametros', 'usuarios'],
    icon: <Settings size={16} className="text-gray-400" />,
    badge: 'Módulo',
  },
]

export function GlobalSearch() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Atalho global de teclado: Ctrl+K, Cmd+K ou /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em outros inputs/textareas
      const target = e.target as HTMLElement
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      } else if (e.key === '/' && !isInput) {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Módulos locais que combinam com a busca (0ms de latência)
  const matchedModules = useMemo(() => {
    const cleanQ = query.trim().toLowerCase()
    if (!cleanQ) return SYSTEM_MODULES.slice(0, 5)

    return SYSTEM_MODULES.filter((m) => {
      if (m.title.toLowerCase().includes(cleanQ)) return true
      if (m.subtitle.toLowerCase().includes(cleanQ)) return true
      return m.keywords.some((k) => k.includes(cleanQ))
    }).slice(0, 6)
  }, [query])

  // Executa busca assíncrona profunda no Supabase quando há termo digitado
  useEffect(() => {
    const cleanQ = query.trim()

    if (!cleanQ) {
      setResults(
        matchedModules.map((m) => ({
          id: `mod-${m.href}`,
          title: m.title,
          subtitle: m.subtitle,
          category: 'modulo',
          href: m.href,
          icon: m.icon,
          badge: m.badge,
        }))
      )
      setLoading(false)
      setSelectedIndex(0)
      return
    }

    // Pré-popula imediatamente com os módulos locais
    const initialList: SearchResultItem[] = matchedModules.map((m) => ({
      id: `mod-${m.href}`,
      title: m.title,
      subtitle: m.subtitle,
      category: 'modulo',
      href: m.href,
      icon: m.icon,
      badge: m.badge,
    }))

    setResults(initialList)
    setSelectedIndex(0)
    setLoading(true)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

        // Consultas paralelas em Supabase
        const [resColabs, resEqs, resProds, resDds] = await Promise.all([
          // 1. Colaboradores / RH
          supabase
            .from('rh_efetivo')
            .select('id, nome, cargo, matricula, matricula_hydro, setor, status')
            .or(`nome.ilike.%${cleanQ}%,cargo.ilike.%${cleanQ}%,matricula.ilike.%${cleanQ}%,matricula_hydro.ilike.%${cleanQ}%`)
            .limit(6),

          // 2. Equipamentos
          supabase
            .from('eq_equipments')
            .select('id, name, plate_tag, category, type, status')
            .or(`name.ilike.%${cleanQ}%,plate_tag.ilike.%${cleanQ}%,category.ilike.%${cleanQ}%,type.ilike.%${cleanQ}%`)
            .limit(6),

          // 3. Almoxarifado / Produtos
          supabase
            .from('al_products')
            .select('id, name, code, current_stock, unit')
            .or(`name.ilike.%${cleanQ}%,code.ilike.%${cleanQ}%`)
            .limit(6),

          // 4. Diálogo Diário de Segurança (DDS)
          supabase
            .from('seguranca_dds')
            .select('id, tema, date')
            .ilike('tema', `%${cleanQ}%`)
            .limit(4),
        ])

        const serverItems: SearchResultItem[] = []

        // Formata colaboradores
        if (resColabs.data && resColabs.data.length > 0) {
          resColabs.data.forEach((c) => {
            const mat = c.matricula || c.matricula_hydro || '-'
            serverItems.push({
              id: `colab-${c.id}`,
              title: c.nome,
              subtitle: `${c.cargo || 'Colaborador'} • Matrícula: ${mat} ${c.status ? `(${c.status})` : ''}`,
              category: 'colaborador',
              href: `/rh/efetivo?id=${c.id}&colaborador=${encodeURIComponent(c.nome)}`,
              icon: <Users size={16} className="text-sky-400" />,
              badge: 'Colaborador',
            })
          })
        }

        // Formata equipamentos
        if (resEqs.data && resEqs.data.length > 0) {
          resEqs.data.forEach((eq) => {
            serverItems.push({
              id: `eq-${eq.id}`,
              title: `${eq.name} ${eq.plate_tag ? `(${eq.plate_tag})` : ''}`,
              subtitle: `${eq.category || eq.type || 'Equipamento'} • Status: ${eq.status || 'Disponível'}`,
              category: 'equipamento',
              href: `/equipamentos/todos?id=${eq.id}&tag=${encodeURIComponent(eq.plate_tag || eq.name)}`,
              icon: <Truck size={16} className="text-orange-400" />,
              badge: 'Equipamento',
            })
          })
        }

        // Formata produtos do almoxarifado
        if (resProds.data && resProds.data.length > 0) {
          resProds.data.forEach((p) => {
            serverItems.push({
              id: `prod-${p.id}`,
              title: p.name,
              subtitle: `Código: ${p.code || '-'} • Estoque: ${p.current_stock ?? 0} ${p.unit || 'un'}`,
              category: 'almoxarifado',
              href: `/almoxarifado/estoque?busca=${encodeURIComponent(p.name)}`,
              icon: <Package size={16} className="text-emerald-400" />,
              badge: 'Almoxarifado',
            })
          })
        }

        // Formata temas de DDS
        if (resDds.data && resDds.data.length > 0) {
          resDds.data.forEach((d) => {
            const dt = d.date ? d.date.split('-').reverse().join('/') : ''
            serverItems.push({
              id: `dds-${d.id}`,
              title: `DDS: ${d.tema}`,
              subtitle: `Realizado em: ${dt || 'Data não informada'}`,
              category: 'seguranca',
              href: `/seguranca/dds?data=${d.date || ''}`,
              icon: <Coffee size={16} className="text-amber-400" />,
              badge: 'DDS',
            })
          })
        }

        // Concatena: módulos correspondentes primeiro, depois os dados do banco
        setResults([...initialList, ...serverItems])
      } catch (err) {
        console.warn('[GlobalSearch] Erro ao buscar no banco:', err)
      } finally {
        setLoading(false)
      }
    }, 180)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, matchedModules])

  // Navega até o item selecionado
  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false)
    setQuery('')
    startTransition(() => {
      navigate({ to: item.href as any })
    })
  }

  // Controle de teclado (setas e Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results.length > 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  // Garante scroll visível do item selecionado
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  // Agrupamento de resultados
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: SearchResultItem[] } = {}
    results.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    })
    return groups
  }, [results])

  const categoryLabels: Record<string, { label: string; color: string }> = {
    modulo: { label: 'Módulos & Atalhos', color: 'text-yellow-400' },
    colaborador: { label: 'Colaboradores (RH)', color: 'text-sky-400' },
    equipamento: { label: 'Equipamentos & Frota', color: 'text-orange-400' },
    almoxarifado: { label: 'Estoque & Materiais', color: 'text-emerald-400' },
    documento: { label: 'Documentos', color: 'text-purple-400' },
    seguranca: { label: 'Segurança & DDS', color: 'text-amber-400' },
  }

  return (
    <div className="relative w-full max-w-[500px]" ref={containerRef}>
      {/* Input principal estilizado na Topbar */}
      <div
        className={`search flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-text ${
          isOpen
            ? isDark
              ? 'bg-[#121215] border-[#D6A72B] shadow-[0_0_0_3px_rgba(214,167,43,0.18)]'
              : 'bg-white border-[#D6A72B] shadow-[0_0_0_3px_rgba(214,167,43,0.18)]'
            : isDark
            ? 'bg-[#151518] hover:bg-[#1a1a1f] border-white/10 hover:border-white/20'
            : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => {
          setIsOpen(true)
          inputRef.current?.focus()
        }}
      >
        <Search
          size={17}
          className={`shrink-0 transition-colors ${
            isOpen ? 'text-[#D6A72B]' : isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        />

        <input
          ref={inputRef}
          id="globalSearchInput"
          type="text"
          value={query}
          placeholder="Buscar colaboradores, documentos, equipamentos..."
          aria-label="Buscar em todo o sistema"
          aria-expanded={isOpen}
          className="w-full bg-transparent border-0 outline-none text-xs md:text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />

        {loading ? (
          <Loader2 size={15} className="animate-spin text-[#D6A72B] shrink-0" />
        ) : query ? (
          <button
            type="button"
            className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setQuery('')
              inputRef.current?.focus()
            }}
            title="Limpar busca"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded shadow-sm select-none"
            title="Atalho de busca"
          >
            <span>Ctrl</span>
            <span>K</span>
          </kbd>
        )}
      </div>

      {/* Painel Dropdown Flutuante de Resultados */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border shadow-2xl overflow-hidden z-[9999] transition-all duration-200 backdrop-blur-xl ${
            isDark
              ? 'bg-[#101013]/95 border-white/15 text-white shadow-black/80'
              : 'bg-white/95 border-gray-200 text-gray-900 shadow-xl'
          }`}
          style={{
            maxHeight: 'min(75vh, 520px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Cabeçalho do Painel */}
          <div
            className={`flex items-center justify-between px-4 py-2.5 text-xs font-semibold border-b ${
              isDark ? 'border-white/10 text-gray-400 bg-white/5' : 'border-gray-100 text-gray-500 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-[#D6A72B]" />
              <span>
                {query
                  ? `Resultados para "${query}" (${results.length})`
                  : 'Navegação Rápida & Sugestões'}
              </span>
            </div>
            {loading && <span className="text-[11px] text-[#D6A72B] animate-pulse">Buscando...</span>}
          </div>

          {/* Lista de Resultados Rolável */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-white/5"
            tabIndex={-1}
          >
            {results.length === 0 && !loading ? (
              <div className="py-10 text-center">
                <Search size={32} className="mx-auto text-gray-400 mb-2 opacity-40" />
                <p className="text-sm font-semibold">Nenhum resultado encontrado</p>
                <p className="text-xs text-gray-400 mt-1">
                  Não encontramos nada correspondente a "{query}". Verifique o termo digitado.
                </p>
              </div>
            ) : (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full text-left flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group ${
                      isSelected
                        ? isDark
                          ? 'bg-[#D6A72B]/20 border border-[#D6A72B]/40 text-white'
                          : 'bg-[#D6A72B]/15 border border-[#D6A72B]/40 text-gray-900'
                        : isDark
                        ? 'hover:bg-white/5 text-gray-200'
                        : 'hover:bg-gray-100 text-gray-800'
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => {
                      setSelectedIndex(idx)
                      if (item.href && item.href !== '#') {
                        router.preloadRoute({ to: item.href as any }).catch(() => {})
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isDark ? 'bg-white/10' : 'bg-gray-100'
                        }`}
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs md:text-sm truncate flex items-center gap-2">
                          <span className="truncate">{item.title}</span>
                        </div>
                        {item.subtitle && (
                          <div
                            className={`text-[11px] truncate mt-0.5 ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                            item.category === 'colaborador'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : item.category === 'equipamento'
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                              : item.category === 'almoxarifado'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : item.category === 'seguranca'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      <div
                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                          isSelected ? 'opacity-100' : ''
                        }`}
                      >
                        <CornerDownLeft size={14} className="text-[#D6A72B]" />
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Rodapé com Dicas de Atalhos */}
          <div
            className={`flex items-center justify-between px-4 py-2 text-[11px] border-t ${
              isDark ? 'border-white/10 text-gray-500 bg-white/5' : 'border-gray-100 text-gray-400 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-black/20 rounded text-[10px]">↑</kbd>
                <kbd className="px-1 py-0.2 bg-black/20 rounded text-[10px]">↓</kbd>
                Navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-black/20 rounded text-[10px]">↵ Enter</kbd>
                Abrir
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-black/20 rounded text-[10px]">Esc</kbd>
                Fechar
              </span>
            </div>
            <span className="font-semibold text-[#D6A72B]">Sucena Spotlight</span>
          </div>
        </div>
      )}
    </div>
  )
}

