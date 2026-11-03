import { supabase } from './supabase'

export interface SearchResultItem {
  id: string
  title: string
  subtitle?: string
  category: 'modulo' | 'colaborador' | 'equipamento' | 'almoxarifado' | 'documento' | 'seguranca'
  href: string
  badge?: string
}

export interface SystemModule {
  title: string
  subtitle: string
  href: string
  keywords: string[]
  badge: string
}

export const SYSTEM_MODULES: SystemModule[] = [
  {
    title: 'Painel Principal / Destaques',
    subtitle: 'Visão geral da operação e destaques do dia',
    href: '/dashboard',
    keywords: ['dashboard', 'destaques', 'inicio', 'home', 'painel', 'resumo', 'indicadores'],
    badge: 'Módulo',
  },
  {
    title: 'Almoxarifado & Estoque',
    subtitle: 'Gestão de materiais, EPIs, ferramentas e produtos',
    href: '/almoxarifado/estoque',
    keywords: ['almoxarifado', 'estoque', 'produtos', 'materiais', 'saldo', 'itens', 'ferramentas'],
    badge: 'Módulo',
  },
  {
    title: 'Requisição Rápida de EPI',
    subtitle: 'Solicitação e troca de equipamentos de proteção',
    href: '/almoxarifado/requisicoes/nova',
    keywords: ['requisicao', 'epi', 'troca de epi', 'bota', 'luva', 'capacete', 'oculos', 'uniforme'],
    badge: 'Módulo',
  },
  {
    title: 'Equipamentos & Frota',
    subtitle: 'Controle de caminhões, máquinas, checklists e vistorias',
    href: '/equipamentos',
    keywords: ['equipamentos', 'caminhao', 'frota', 'maquinas', 'pipa', 'trator', 'vistorias', 'laudos'],
    badge: 'Módulo',
  },
  {
    title: 'App Motorista',
    subtitle: 'Início e fim de jornada, KM, horímetro e anomalias',
    href: '/equipamentos/app-motorista',
    keywords: ['motorista', 'app motorista', 'jornada', 'km', 'horimetro', 'anomalias', 'abastecimento'],
    badge: 'Módulo',
  },
  {
    title: 'Crachá Vinculado (Equipamentos)',
    subtitle: 'Vínculo de motoristas aos equipamentos pesados da frota',
    href: '/equipamentos/cracha-vinculado',
    keywords: ['cracha', 'crachá', 'vinculado', 'cracha vinculado', 'motoristas equipamentos', 'frota motorista', 'pesados'],
    badge: 'Módulo',
  },
  {
    title: 'Recursos Humanos (RH)',
    subtitle: 'Quadro de efetivo, colaboradores, matrículas e presenças',
    href: '/rh',
    keywords: ['rh', 'recursos humanos', 'colaboradores', 'funcionarios', 'efetivo', 'admissao', 'cargos'],
    badge: 'Módulo',
  },
  {
    title: 'Relatório Diário de Presença',
    subtitle: 'Lista de presença por área e turno de trabalho',
    href: '/rh/relatorio-presenca',
    keywords: ['presenca', 'frequencia', 'relatorio de presenca', 'faltas', 'diario'],
    badge: 'Módulo',
  },
  {
    title: 'Segurança do Trabalho (SST)',
    subtitle: 'Central de segurança, formulários, normas e rotinas',
    href: '/seguranca',
    keywords: ['seguranca', 'sst', 'sesmt', 'tst', 'normas', 'cipa'],
    badge: 'Módulo',
  },
  {
    title: 'Diálogo Diário de Segurança (DDS)',
    subtitle: 'Temas, agendamentos, palestrantes e listas de DDS',
    href: '/seguranca/dds',
    keywords: ['dds', 'dialogo diario de seguranca', 'palestra', 'tema dds', 'palestrante'],
    badge: 'Módulo',
  },
  {
    title: 'Relato de Desvios de Segurança',
    subtitle: 'Registro de desvios comportamentais e estruturais',
    href: '/seguranca/desvios',
    keywords: ['desvios', 'desvio', 'quase acidente', 'risco', 'seguranca desvios', 'relato'],
    badge: 'Módulo',
  },
  {
    title: 'Análise Preliminar de Risco (APR)',
    subtitle: 'Emissão e controle de validade de análises de risco',
    href: '/seguranca/analise-risco',
    keywords: ['analise de risco', 'apr', 'risco', 'atividade', 'validade apr', 'seguranca'],
    badge: 'Módulo',
  },
  {
    title: 'Inspeção de Canteiro de Obras',
    subtitle: 'Auditorias programadas, checklist de itens e pontuação',
    href: '/seguranca/inspecao-canteiro',
    keywords: ['inspecao canteiro', 'auditoria', 'canteiro', 'pontos', 'conformidade'],
    badge: 'Módulo',
  },
  {
    title: 'Inspeção Mensal de Cintas',
    subtitle: 'Controle de cintas de içamento e código de cores',
    href: '/seguranca/cintas',
    keywords: ['cintas', 'icamento', 'inspecao de cintas', 'cor do mes', 'amarracao'],
    badge: 'Módulo',
  },
  {
    title: 'Controle de ASO (Saúde Ocupacional)',
    subtitle: 'Acompanhamento de vencimentos e renovação de ASOs',
    href: '/seguranca/controle-aso',
    keywords: ['aso', 'saude', 'medico', 'exames', 'periodico', 'admissional', 'vencimento aso'],
    badge: 'Módulo',
  },
  {
    title: 'Documentos & Procedimentos',
    subtitle: 'Biblioteca de documentos por cargo e procedimentos operacionais',
    href: '/documentos',
    keywords: ['documentos', 'arquivos', 'pasta', 'procedimentos', 'normas', 'manuais', 'pdf'],
    badge: 'Módulo',
  },
  {
    title: 'Relatório Diário de Obra (RDO)',
    subtitle: 'Registro de atividades, clima, mão de obra e equipamentos',
    href: '/relatorio-obra',
    keywords: ['rdo', 'relatorio de obra', 'diario de obra', 'obra', 'planejamento', 'avanco'],
    badge: 'Módulo',
  },
  {
    title: 'Instacena (Rede Social da Obra)',
    subtitle: 'Feed de fotos, conquistas, stories e comentários da equipe',
    href: '/instacena',
    keywords: ['instacena', 'social', 'feed', 'fotos', 'stories', 'publicacao', 'curtidas'],
    badge: 'Módulo',
  },
  {
    title: 'Lembretes & Compromissos',
    subtitle: 'Lembretes automáticos com avisos no WhatsApp',
    href: '/lembretes',
    keywords: ['lembretes', 'compromissos', 'avisos', 'tarefas', 'agenda'],
    badge: 'Módulo',
  },
  {
    title: 'Meio Ambiente & Sustentabilidade',
    subtitle: 'Controle de resíduos, água, efluentes e pluviosidade',
    href: '/meio-ambiente',
    keywords: ['meio ambiente', 'residuos', 'agua', 'efluentes', 'pluviometria', 'sustentabilidade'],
    badge: 'Módulo',
  },
  {
    title: 'Painel Administrativo & WhatsApp',
    subtitle: 'Configurações do sistema, envio automático de WhatsApp e usuários',
    href: '/admin',
    keywords: ['admin', 'administracao', 'configuracoes', 'whatsapp', 'mensagens', 'parametros', 'usuarios'],
    badge: 'Módulo',
  },
]

export function filterSystemModules(query: string): SearchResultItem[] {
  const cleanQ = query.trim().toLowerCase()
  if (!cleanQ) {
    return SYSTEM_MODULES.slice(0, 6).map((m) => ({
      id: `mod-${m.href}`,
      title: m.title,
      subtitle: m.subtitle,
      category: 'modulo',
      href: m.href,
      badge: m.badge,
    }))
  }

  return SYSTEM_MODULES.filter((m) => {
    if (m.title.toLowerCase().includes(cleanQ)) return true
    if (m.subtitle.toLowerCase().includes(cleanQ)) return true
    return m.keywords.some((k) => k.includes(cleanQ))
  }).map((m) => ({
    id: `mod-${m.href}`,
    title: m.title,
    subtitle: m.subtitle,
    category: 'modulo',
    href: m.href,
    badge: m.badge,
  }))
}

export async function searchGlobalDatabase(term: string): Promise<SearchResultItem[]> {
  const cleanQ = term.trim()
  if (!cleanQ) return []

  try {
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

    const items: SearchResultItem[] = []

    if (resColabs.data && resColabs.data.length > 0) {
      resColabs.data.forEach((c) => {
        const mat = c.matricula || c.matricula_hydro || '-'
        items.push({
          id: `colab-${c.id}`,
          title: c.nome,
          subtitle: `${c.cargo || 'Colaborador'} • Matrícula: ${mat} ${c.status ? `(${c.status})` : ''}`,
          category: 'colaborador',
          href: `/rh/efetivo?id=${c.id}&colaborador=${encodeURIComponent(c.nome)}`,
          badge: 'Colaborador',
        })
      })
    }

    if (resEqs.data && resEqs.data.length > 0) {
      resEqs.data.forEach((eq) => {
        items.push({
          id: `eq-${eq.id}`,
          title: `${eq.name} ${eq.plate_tag ? `(${eq.plate_tag})` : ''}`,
          subtitle: `${eq.category || eq.type || 'Equipamento'} • Status: ${eq.status || 'Disponível'}`,
          category: 'equipamento',
          href: `/equipamentos/todos?id=${eq.id}&tag=${encodeURIComponent(eq.plate_tag || eq.name)}`,
          badge: 'Equipamento',
        })
      })
    }

    if (resProds.data && resProds.data.length > 0) {
      resProds.data.forEach((p) => {
        items.push({
          id: `prod-${p.id}`,
          title: p.name,
          subtitle: `Código: ${p.code || '-'} • Estoque: ${p.current_stock ?? 0} ${p.unit || 'un'}`,
          category: 'almoxarifado',
          href: `/almoxarifado/estoque?busca=${encodeURIComponent(p.name)}`,
          badge: 'Almoxarifado',
        })
      })
    }

    if (resDds.data && resDds.data.length > 0) {
      resDds.data.forEach((d) => {
        const dt = d.date ? d.date.split('-').reverse().join('/') : ''
        items.push({
          id: `dds-${d.id}`,
          title: `DDS: ${d.tema}`,
          subtitle: `Realizado em: ${dt || 'Data não informada'}`,
          category: 'seguranca',
          href: `/seguranca/dds?data=${d.date || ''}`,
          badge: 'DDS',
        })
      })
    }

    return items
  } catch (err) {
    console.warn('[globalSearch] Erro ao buscar no banco:', err)
    return []
  }
}

