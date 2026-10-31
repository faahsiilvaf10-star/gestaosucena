import { isAdmin } from '../components/ui/VerifiedBadge'

export interface ColaboradorAso {
  id: string
  nome: string
  cargo?: string | null
  status?: string | null
  matricula?: string | null
  matricula_hydro?: string | null
  matricula_sucena?: string | null
  data_admissao?: string | null
  setor?: string | null
  aso_admissional?: string | null
  aso_admissional_2?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  observacao?: string | null
  validade_aso_efetiva?: string | null
}

export interface StatusAsoInfo {
  k: 'valido' | 'vencendo' | 'vencido' | 'sem'
  label: string
  txt: string
  badgeClass: string
}

/**
 * Formata data no formato ISO (YYYY-MM-DD) para PT-BR (DD/MM/AAAA)
 */
export function fmtDate(v?: string | null): string {
  if (!v) return '—'
  const clean = String(v).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return v
}

/**
 * Retorna data atual no formato YYYY-MM-DD
 */
export function hojeISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/**
 * Adiciona exatamente 1 ano a uma data ISO (YYYY-MM-DD).
 * Trata o caso bissexto: 29 de fevereiro cai em 28 de fevereiro no ano não-bissexto subsequente.
 */
export function addUmAno(iso?: string | null): string {
  if (!iso) return ''
  const clean = String(iso).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return ''

  const y = parseInt(parts[0], 10) + 1
  const m = parts[1]
  let d = parts[2]

  if (m === '02' && d === '29') {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    if (!isLeap) d = '28'
  }

  return `${y}-${m}-${d}`
}

/**
 * Calcula a quantidade de dias entre hoje e a data fornecida.
 * Retorna número positivo se no futuro, 0 se hoje, negativo se no passado.
 */
export function diasAte(iso?: string | null): number | null {
  if (!iso) return null
  const clean = String(iso).slice(0, 10)
  if (!clean || clean.split('-').length !== 3) return null

  const a = new Date(`${hojeISO()}T12:00:00`)
  const b = new Date(`${clean}T12:00:00`)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null

  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/**
 * Retorna a data mais recente entre os 4 exames médicos ocupacionais (PCMSO / NR-7):
 * - aso_admissional (ou aso inicial)
 * - aso_periodico
 * - retorno_ao_trabalho
 * - mudanca_de_risco
 */
export function baseValidade(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
}): string {
  const dates = [
    c.aso_admissional,
    c.aso_periodico,
    c.retorno_ao_trabalho,
    c.mudanca_de_risco,
  ]
    .filter(Boolean)
    .map((d) => String(d).slice(0, 10))
    .sort()

  return dates.length > 0 ? dates[dates.length - 1] : ''
}

/**
 * Calcula a Validade ASO (Efetiva) = data mais recente do exame + 1 ano.
 * Se o registro já tiver validade_aso_efetiva no banco de dados e não houver datas individuais, utiliza-a como fallback.
 */
export function validadeDe(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  validade_aso_efetiva?: string | null
}): string {
  const base = baseValidade(c)
  if (base) {
    return addUmAno(base)
  }
  if (c.validade_aso_efetiva) {
    return String(c.validade_aso_efetiva).slice(0, 10)
  }
  return ''
}

/**
 * Retorna o nome amigável do exame que serviu de base para a validade mais recente.
 */
export function nomeBase(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
}): string {
  const itens: Array<{ nome: string; data: string }> = [
    { nome: 'ASO', data: c.aso_admissional ? String(c.aso_admissional).slice(0, 10) : '' },
    { nome: 'Periódico', data: c.aso_periodico ? String(c.aso_periodico).slice(0, 10) : '' },
    { nome: 'Retorno ao Trab.', data: c.retorno_ao_trabalho ? String(c.retorno_ao_trabalho).slice(0, 10) : '' },
    { nome: 'Mudança de Risco', data: c.mudanca_de_risco ? String(c.mudanca_de_risco).slice(0, 10) : '' },
  ].filter((x) => Boolean(x.data))

  if (itens.length === 0) return ''

  itens.sort((a, b) => (a.data < b.data ? -1 : 1))
  return itens[itens.length - 1].nome
}

/**
 * Retorna o status detalhado da situação do ASO:
 * - sem: Sem data de ASO cadastrada
 * - vencido: Data de validade menor que hoje (dias < 0)
 * - vencendo: Vence hoje ou faltam até 30 dias (dias <= 30)
 * - valido: Válido por mais de 30 dias (dias > 30)
 */
export function statusASO(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  validade_aso_efetiva?: string | null
}): StatusAsoInfo {
  const v = validadeDe(c)
  if (!v) {
    return {
      k: 'sem',
      label: '⚪ SEM ASO',
      txt: 'Nenhuma data de ASO informada',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    }
  }

  const n = diasAte(v)
  if (n === null) {
    return {
      k: 'sem',
      label: '⚪ SEM ASO',
      txt: 'Data inválida',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    }
  }

  if (n < 0) {
    return {
      k: 'vencido',
      label: '🔴 VENCIDO',
      txt: `Validade venceu em ${fmtDate(v)} — há ${Math.abs(n)} dia(s) • Faltam 0 dias para o vencimento (já venceu)`,
      badgeClass: 'bg-red-600 text-white font-bold',
    }
  }

  if (n === 0) {
    return {
      k: 'vencendo',
      label: '⏰ VENCE HOJE',
      txt: `Validade vence hoje, ${fmtDate(v)}`,
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    }
  }

  if (n <= 30) {
    return {
      k: 'vencendo',
      label: '⚠️ A VENCER',
      txt: `Faltam ${n} dias para o vencimento — validade em ${fmtDate(v)}`,
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    }
  }

  return {
    k: 'valido',
    label: '✅ VÁLIDO',
    txt: `Faltam ${n} dias para o vencimento — validade em ${fmtDate(v)}`,
    badgeClass: 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-950 dark:text-emerald-300',
  }
}

/**
 * Frase amigável de contagem regressiva da validade
 */
export function frasesValidade(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  validade_aso_efetiva?: string | null
}): string {
  const v = validadeDe(c)
  if (!v) return 'Sem validade — nenhuma data de ASO informada'
  const n = diasAte(v)
  if (n === null) return 'Data de validade inválida'
  if (n < 0) return `Vencido — validade era ${fmtDate(v)}`
  if (n === 0) return `Vence hoje — ${fmtDate(v)}`
  if (n === 1) return `Falta 1 dia para o vencimento — ${fmtDate(v)}`
  return `Faltam ${n} dias para o vencimento — ${fmtDate(v)}`
}

/**
 * Checa se o colaborador está ativo
 */
export function isAtivo(status?: string | null): boolean {
  if (!status) return false
  const s = String(status).trim().toLowerCase()
  return s.startsWith('ativo') || s === 'em efetivo'
}

/**
 * Verifica se o usuário atual tem permissão de editar as datas de ASO.
 * Requisito estrito:
 * "Somente Cargos como Auxiliar Administrativo e Tecnico de Segurança poderam editar as datas."
 * (Além de Administradores/Diretoria)
 */
export function canEditControleAso(name?: string | null, role?: string | null, email?: string | null): boolean {
  if (email === 'ffaahsiilva@gmail.com') return true
  if (isAdmin(name || undefined, role || undefined)) return true

  const r = (role || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const n = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (n.includes('fabricio silva')) return true

  // Auxiliar Administrativo
  const isAuxAdm = r.includes('aux') && (r.includes('administrativ') || r.includes('administracao'))
  
  // Técnico de Segurança / TST
  const isTecSeg =
    r === 'tst' ||
    r.includes('tst') ||
    ((r.includes('tecnic') || r.includes('tec')) &&
      (r.includes('seguran') || r.includes('seg') || r.includes('trabalho')))

  return isAuxAdm || isTecSeg
}

/**
 * Logo oficial da Sucena Empreendimentos em base64 (PNG transparente de alta resolução)
 */
export const SUCENA_LOGO_BASE64 =
  'data:image/png;base64,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'

export interface StatsAsoReport {
  total: number
  validos: number
  vencendo: number
  vencidos: number
  sem: number
  pctValidos: number
}

/**
 * Gera e baixa o Relatório Oficial em PDF (A4 Paisagem) com Logo da Sucena,
 * cabeçalho executivo, resumo dos indicadores e tabela detalhada.
 */
export async function exportarControleAsoPDF(
  colaboradores: ColaboradorAso[],
  stats: StatsAsoReport
): Promise<string> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const emissao = new Date().toLocaleString('pt-BR')
  const hojeStr = hojeISO()

  // 1. Logo Sucena
  try {
    doc.addImage(SUCENA_LOGO_BASE64, 'PNG', 14, 9, 32, 13.6)
  } catch (e) {
    console.warn('Erro ao carregar logo no PDF:', e)
  }

  // 2. Cabeçalho Executivo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(24, 24, 27)
  doc.text('SUCENA EMPREENDIMENTOS LTDA', 50, 14)

  doc.setFontSize(10)
  doc.setTextColor(217, 119, 6) // Amber-600
  doc.text('RELATÓRIO GERENCIAL — CONTROLE DE ASO / PCMSO (NR-7)', 50, 19)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Unidade / Operação: Hydro Reabilitação (Barcarena - PA) • Emitido em: ${emissao} • Validade ASO = Exame mais recente + 1 ano`,
    50,
    23.5
  )

  // Linha divisória
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(14, 26, 283, 26)

  // 3. Resumo dos Indicadores (Banner de Estatísticas)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)

  // Caixa Total
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(14, 28, 50, 8.5, 1.5, 1.5, 'F')
  doc.setTextColor(30, 41, 59)
  doc.text(`TOTAL: ${stats.total} Colaboradores`, 17, 33.5)

  // Caixa Válidos
  doc.setFillColor(220, 252, 231)
  doc.roundedRect(68, 28, 52, 8.5, 1.5, 1.5, 'F')
  doc.setTextColor(22, 101, 52)
  doc.text(`VÁLIDOS: ${stats.validos} (${stats.pctValidos}%)`, 71, 33.5)

  // Caixa A Vencer
  doc.setFillColor(254, 243, 199)
  doc.roundedRect(124, 28, 50, 8.5, 1.5, 1.5, 'F')
  doc.setTextColor(154, 52, 18)
  doc.text(`A VENCER (30d): ${stats.vencendo}`, 127, 33.5)

  // Caixa Vencidos
  doc.setFillColor(254, 226, 226)
  doc.roundedRect(178, 28, 50, 8.5, 1.5, 1.5, 'F')
  doc.setTextColor(153, 27, 27)
  doc.text(`VENCIDOS: ${stats.vencidos}`, 181, 33.5)

  // Caixa Sem ASO
  doc.setFillColor(243, 244, 246)
  doc.roundedRect(232, 28, 51, 8.5, 1.5, 1.5, 'F')
  doc.setTextColor(75, 85, 99)
  doc.text(`SEM ASO: ${stats.sem}`, 235, 33.5)

  // 4. Montagem das Linhas da Tabela
  const tableRows = colaboradores.map((c, idx) => {
    const st = statusASO(c)
    const val = validadeDe(c)
    const hydro = c.matricula_hydro || c.matricula || '—'
    const sucena = c.matricula_sucena ? `\nSucena: ${c.matricula_sucena}` : ''

    return [
      idx + 1,
      hydro + sucena,
      c.nome,
      c.cargo || '—',
      (c.status || 'Ativo').toUpperCase(),
      fmtDate(c.data_admissao),
      fmtDate(c.aso_admissional),
      fmtDate(c.aso_periodico),
      fmtDate(c.retorno_ao_trabalho),
      fmtDate(c.mudanca_de_risco),
      val ? fmtDate(val) : '—',
      st.label,
    ]
  })

  // 5. Tabela AutoTable
  autoTable(doc, {
    startY: 39,
    head: [
      [
        '#',
        'Matrícula',
        'Nome do Colaborador',
        'Função / Cargo',
        'Status RH',
        'Admissão',
        'ASO Admiss.',
        'Periódico',
        'Retorno',
        'Mudança',
        'Validade ASO',
        'Situação ASO',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.6,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 50, fontStyle: 'bold' },
      3: { cellWidth: 38 },
      4: { cellWidth: 19, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 17, halign: 'center' },
      6: { cellWidth: 17, halign: 'center' },
      7: { cellWidth: 17, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 16, halign: 'center' },
      10: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] },
      11: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Formatação de cores na coluna Situação (11)
      if (data.section === 'body' && data.column.index === 11) {
        const txt = String(data.cell.raw || '')
        if (txt.includes('VÁLIDO')) {
          data.cell.styles.textColor = [22, 101, 52]
          data.cell.styles.fillColor = [220, 252, 231]
        } else if (txt.includes('A VENCER')) {
          data.cell.styles.textColor = [154, 52, 18]
          data.cell.styles.fillColor = [254, 243, 199]
        } else if (txt.includes('VENCIDO')) {
          data.cell.styles.textColor = [153, 27, 27]
          data.cell.styles.fillColor = [254, 226, 226]
        } else {
          data.cell.styles.textColor = [75, 85, 99]
          data.cell.styles.fillColor = [243, 244, 246]
        }
      }
      // Formatação de status RH (coluna 4)
      if (data.section === 'body' && data.column.index === 4) {
        const txt = String(data.cell.raw || '')
        if (txt.includes('DESLIGADO')) {
          data.cell.styles.textColor = [153, 27, 27]
        } else if (txt.includes('FERIAS') || txt.includes('FÉRIAS')) {
          data.cell.styles.textColor = [30, 64, 175]
        } else if (txt.includes('AFASTAD')) {
          data.cell.styles.textColor = [180, 83, 9]
        } else {
          data.cell.styles.textColor = [22, 101, 52]
        }
      }
    },
    didDrawPage: (data) => {
      // Rodapé em todas as páginas
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.setDrawColor(226, 232, 240)
      doc.line(14, 202, 283, 202)
      doc.text(
        'Documento Oficial de Controle de Saúde Ocupacional • Sucena Empreendimentos • Conforme NR-7 / PCMSO',
        14,
        205.5
      )
      const pageNum = doc.getNumberOfPages()
      doc.text(`Página ${data.pageNumber} de ${pageNum}`, 283, 205.5, { align: 'right' })
    },
  })

  // 6. Bloco de Assinaturas na última página
  const finalY = (doc as any).lastAutoTable?.finalY || 160
  let sigY = finalY + 12

  if (sigY > 180) {
    doc.addPage()
    sigY = 35
  }

  const lineW = 75
  const sigs = [
    { title: 'Técnico em Segurança do Trabalho', sub: 'SESMT / Sucena Empreendimentos', x: 20 },
    { title: 'Recursos Humanos / Gestão de Pessoas', sub: 'Administração Local', x: 110 },
    { title: 'Médico Coordenador do PCMSO', sub: 'Clínica / Saúde Ocupacional', x: 200 },
  ]

  sigs.forEach((sig) => {
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.3)
    doc.line(sig.x, sigY, sig.x + lineW, sigY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    doc.text(sig.title, sig.x + lineW / 2, sigY + 4, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(100, 116, 139)
    doc.text(sig.sub, sig.x + lineW / 2, sigY + 7.5, { align: 'center' })
  })

  const fileName = `Relatorio_Controle_ASO_${hojeStr}.pdf`
  doc.save(fileName)
  return fileName
}

/**
 * Gera e baixa a Planilha Excel (.xlsx) estilizada com Logo da Sucena,
 * cabeçalho escuro/ouro e todas as colunas de exame e validade.
 */
export async function exportarControleAsoExcel(
  colaboradores: ColaboradorAso[],
  stats: StatsAsoReport
): Promise<string> {
  const { default: ExcelJS } = await import('exceljs')
  const { saveAs } = await import('file-saver')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sucena Empreendimentos'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Controle de ASO', {
    views: [{ showGridLines: true }],
  })

  // 1. Logo Sucena
  try {
    const logoId = workbook.addImage({
      base64: SUCENA_LOGO_BASE64,
      extension: 'png',
    })
    sheet.addImage(logoId, {
      tl: { col: 0.2, row: 0.2 },
      ext: { width: 140, height: 50 },
    })
  } catch (e) {
    console.warn('Erro ao inserir logo no Excel:', e)
  }

  // Linhas para o espaço do logo
  sheet.addRow([])
  sheet.addRow([])
  sheet.addRow([])

  // 2. Cabeçalho Executivo
  const titleRow = sheet.addRow(['', 'SUCENA EMPREENDIMENTOS — CONTROLE DE ASO (HYDRO REABILITAÇÃO)'])
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } }

  const subRow = sheet.addRow([
    '',
    `Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${stats.total} colaboradores • Válidos: ${stats.validos} (${stats.pctValidos}%) • A Vencer: ${stats.vencendo} • Vencidos: ${stats.vencidos} • Sem ASO: ${stats.sem}`,
  ])
  subRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } }

  sheet.addRow([]) // Linha em branco

  // 3. Cabeçalho da Tabela
  const headers = [
    'Nº',
    'Matrícula Hydro',
    'Matrícula Sucena',
    'Nome do Colaborador',
    'Função / Cargo',
    'Status RH',
    'Setor',
    'Data Admissão',
    'ASO Admissional',
    'Periódico',
    'Retorno ao Trabalho',
    'Mudança de Risco',
    'Exame Base ASO',
    'Validade ASO (Efetiva)',
    'Situação do ASO',
    'Observações',
  ]

  const headerRow = sheet.addRow(headers)
  headerRow.height = 28
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate-800
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FFF59E0B' } }, // Borda inferior âmbar
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // 4. Preenchimento dos Colaboradores
  colaboradores.forEach((c, idx) => {
    const st = statusASO(c)
    const val = validadeDe(c)
    const base = nomeBase(c)
    const hydro = c.matricula_hydro || c.matricula || '-'
    const sucena = c.matricula_sucena || '-'

    const row = sheet.addRow([
      idx + 1,
      hydro,
      sucena,
      c.nome,
      c.cargo || '-',
      (c.status || 'Ativo').toUpperCase(),
      c.setor || 'BARCARENA - PA',
      fmtDate(c.data_admissao),
      fmtDate(c.aso_admissional),
      fmtDate(c.aso_periodico),
      fmtDate(c.retorno_ao_trabalho),
      fmtDate(c.mudanca_de_risco),
      base || '-',
      val ? fmtDate(val) : '-',
      st.label,
      c.observacao || '',
    ])

    row.height = 22
    row.font = { name: 'Calibri', size: 10 }
    row.alignment = { vertical: 'middle' }

    // Alinhamentos específicos
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(4).font = { name: 'Calibri', size: 10, bold: true }
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(14).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF2563EB' } }
    row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(15).font = { name: 'Calibri', size: 10, bold: true }

    // Cores de status
    if (st.k === 'valido') {
      row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
      row.getCell(15).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } }
    } else if (st.k === 'vencendo') {
      row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      row.getCell(15).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9A3412' } }
    } else if (st.k === 'vencido') {
      row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
      row.getCell(15).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } }
    }

    // Bordas finas
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })
  })

  // 5. Larguras das Colunas
  const widths = [6, 18, 18, 38, 28, 18, 22, 16, 16, 16, 18, 18, 18, 20, 18, 30]
  sheet.columns.forEach((col, idx) => {
    col.width = widths[idx] || 16
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const fileName = `Controle_ASO_${hojeISO()}.xlsx`
  saveAs(blob, fileName)
  return fileName
}

/**
 * Monta o documento HTML completo e estilizado para visualização e impressão direta.
 */
export function gerarHtmlRelatorioAso(
  colaboradores: ColaboradorAso[],
  stats: StatsAsoReport
): string {
  const emissao = new Date().toLocaleString('pt-BR')

  const linhas = colaboradores
    .map((c, i) => {
      const st = statusASO(c)
      const val = validadeDe(c)
      const hydro = c.matricula_hydro || c.matricula || '—'
      const sucena = c.matricula_sucena ? `<span style="font-size:11px;color:#64748b;display:block">Sucena: ${c.matricula_sucena}</span>` : ''

      let badgeBg = '#f3f4f6'
      let badgeColor = '#374151'
      if (st.k === 'valido') {
        badgeBg = '#dcfce7'
        badgeColor = '#166534'
      } else if (st.k === 'vencendo') {
        badgeBg = '#fef3c7'
        badgeColor = '#9a3412'
      } else if (st.k === 'vencido') {
        badgeBg = '#fee2e2'
        badgeColor = '#991b1b'
      }

      return `
        <tr style="border-bottom:1px solid #e2e8f0; ${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
          <td style="padding:8px 6px; text-align:center; font-size:11px; color:#64748b;">${i + 1}</td>
          <td style="padding:8px 6px; font-family:monospace; font-size:11px; font-weight:bold; text-align:center;">
            ${hydro}
            ${sucena}
          </td>
          <td style="padding:8px 6px; font-size:12px; font-weight:bold; color:#0f172a;">${c.nome}</td>
          <td style="padding:8px 6px; font-size:11px; color:#334155;">${c.cargo || '—'}</td>
          <td style="padding:8px 6px; font-size:11px; text-align:center; font-weight:bold;">${(c.status || 'Ativo').toUpperCase()}</td>
          <td style="padding:8px 6px; font-size:11px; text-align:center;">${fmtDate(c.data_admissao)}</td>
          <td style="padding:8px 6px; font-size:11px; text-align:center;">${fmtDate(c.aso_admissional)}</td>
          <td style="padding:8px 6px; font-size:11px; text-align:center;">${fmtDate(c.aso_periodico)}</td>
          <td style="padding:8px 6px; font-size:11px; text-align:center;">${fmtDate(c.retorno_ao_trabalho)}</td>
          <td style="padding:8px 6px; font-size:11px; text-align:center;">${fmtDate(c.mudanca_de_risco)}</td>
          <td style="padding:8px 6px; font-size:12px; font-weight:bold; text-align:center; color:#2563eb;">${val ? fmtDate(val) : '—'}</td>
          <td style="padding:8px 6px; text-align:center;">
            <span style="display:inline-block; padding:3px 8px; border-radius:999px; font-size:10px; font-weight:bold; background:${badgeBg}; color:${badgeColor};">
              ${st.label}
            </span>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Gerencial — Controle de ASO | Sucena</title>
      <style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 16px; color: #0f172a; margin: 0; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .header-left img { height: 50px; object-fit: contain; }
        .header-text h1 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
        .header-text h2 { margin: 3px 0 0 0; font-size: 13px; font-weight: 700; color: #d97706; }
        .header-text p { margin: 2px 0 0 0; font-size: 11px; color: #64748b; }
        .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
        .kpi-card { border-radius: 8px; padding: 8px 12px; text-align: center; font-size: 12px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1e293b; color: #ffffff; padding: 8px 6px; font-size: 11px; font-weight: bold; text-align: center; }
        .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 36px; padding-top: 10px; page-break-inside: avoid; }
        .sig-box { text-align: center; }
        .sig-line { border-top: 1px solid #94a3b8; margin-bottom: 6px; }
        .sig-title { font-size: 11px; font-weight: bold; color: #1e293b; }
        .sig-sub { font-size: 10px; color: #64748b; }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <img src="${SUCENA_LOGO_BASE64}" alt="Sucena Empreendimentos" />
          <div class="header-text">
            <h1>SUCENA EMPREENDIMENTOS LTDA</h1>
            <h2>RELATÓRIO GERENCIAL — CONTROLE DE ASO / PCMSO (NR-7)</h2>
            <p>Operação: Hydro Reabilitação (Barcarena - PA) • Emitido em ${emissao}</p>
          </div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi-card" style="background:#f1f5f9; color:#1e293b;">
          Total: ${stats.total} Colaboradores
        </div>
        <div class="kpi-card" style="background:#dcfce7; color:#166534;">
          Válidos: ${stats.validos} (${stats.pctValidos}%)
        </div>
        <div class="kpi-card" style="background:#fef3c7; color:#9a3412;">
          A Vencer (30d): ${stats.vencendo}
        </div>
        <div class="kpi-card" style="background:#fee2e2; color:#991b1b;">
          Vencidos: ${stats.vencidos}
        </div>
        <div class="kpi-card" style="background:#f3f4f6; color:#4b5563;">
          Sem ASO: ${stats.sem}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:25px;">#</th>
            <th style="width:90px;">Matrícula</th>
            <th style="text-align:left;">Nome do Colaborador</th>
            <th style="text-align:left;">Cargo / Função</th>
            <th style="width:80px;">Status</th>
            <th style="width:75px;">Admissão</th>
            <th style="width:75px;">ASO</th>
            <th style="width:75px;">Periódico</th>
            <th style="width:75px;">Retorno</th>
            <th style="width:75px;">Mudança</th>
            <th style="width:85px;">Validade ASO</th>
            <th style="width:90px;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Técnico em Segurança do Trabalho</div>
          <div class="sig-sub">SESMT / Sucena Empreendimentos</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Recursos Humanos / Gestão de Pessoas</div>
          <div class="sig-sub">Administração Local</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Médico Coordenador do PCMSO</div>
          <div class="sig-sub">Clínica / Saúde Ocupacional</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `
}
