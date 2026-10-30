import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Droplets, CheckCircle2, AlertTriangle, FileDown, Copy, Plus, Trash2, RotateCcw, Calendar, HardHat, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/seguranca/pos-chuva')({
  component: PosChuvaPage,
})

// Os 20 itens exatos do PDF original
const ITEMS: string[] = [
  'O ambiente está livre de condições de materiais, telhas ou estruturas soltas com risco de queda?',
  'As sinalizações de segurança estão devidamente nos seus lugares?',
  'Os isolamentos da área estão devidamente nos seus lugares?',
  'O caminho seguro está sem obstruções e devidamente sinalizado?',
  'O piso de trabalho se encontra adequado para retorno ao trabalho, está livre de áreas alagadas, entre outros?',
  'A área de trabalho está devidamente organizada para retorno ao trabalho?',
  'Todos os acessos, degraus, escadas, proteções coletivas estão limpas, sem resquício de lama, barro, entre outros?',
  'Os EPIs dos empregados estão devidamente limpos e secos para retorno ao trabalho?',
  'O canteiro de apoio, na frente de trabalho, se encontra adequado para retorno ao trabalho?',
  'A área de trabalho em geral está segura para retorno ao trabalho?',
  'As ferramentas, máquinas e equipamentos estão seguros para retorno ao trabalho?',
  'A área de trabalho está segura contra riscos elétricos?',
  'As proteções coletivas (barreiras físicas) das escavações estão ilesas?',
  'Atividades de escavação estão livres de áreas alagadas?',
  'As plataformas de trabalho (em altura) estão seguras para retorno ao trabalho?',
  'A área de trabalho está segura para retorno da operação de equipamentos de guindar?',
  'A área de trabalho está segura para retorno da operação de equipamentos móveis?',
  'A área de trabalho está segura para retorno de atividades a quente?',
  'A área de trabalho está segura para retorno quanto ao risco de queimadura química (risco operacional)?',
  'A área de trabalho está segura para retorno de trabalhos em espaço confinado?',
]

const AVALS = ['Primeira avaliação', 'Segunda avaliação', 'Terceira avaliação'] as const

const ROLES = [
  { k: 'enc', t: 'Ciência do encarregado responsável pela liberação' },
  { k: 'tec', t: 'Ciência do Técnico de Segurança da Contratada' },
] as const

interface PlanoAcaoItem {
  id: string
  item: string
  acao: string
  resp: string
  prazo: string
}

interface AssinaturaAvaliacao {
  aval: string
  role: string
  key: string
  nome: string
  img: string
  data: string
  hora: string
}

interface PosChuvaRecord {
  id: string
  savedAt: string
  head: {
    empresa: string
    data: string
    projeto: string
    contrato: string
    auditor: string
    local: string
    atividade: string
    observacoes: string
    revisao: string
  }
  answers: Record<number, string>
  pa: PlanoAcaoItem[]
  sigs: AssinaturaAvaliacao[]
}

function fmtDateBr(v?: string): string {
  if (!v) return '—'
  const p = v.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v
}

/* ==========================================================================
   GERADOR DE PDF PURO CLIENT-SIDE (EXATAMENTE COMO NO PDF ORIGINAL)
   ========================================================================== */
const PDFW = 595.32
const PDFH = 841.92

let _mc: CanvasRenderingContext2D | null = null
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_mc) {
    const cv = document.createElement('canvas')
    _mc = cv.getContext('2d')
  }
  return _mc!
}

function pdfMeasure(txt: string, size: number, bold: boolean): number {
  const ctx = getMeasureCtx()
  ctx.font = `${bold ? '700 ' : '400 '}${size}px Arial,Helvetica,sans-serif`
  return ctx.measureText(String(txt || '')).width
}

function pdfWrap(txt: string, size: number, bold: boolean, maxW: number): string[] {
  const words = String(txt || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const t = cur ? `${cur} ${words[i]}` : words[i]
    if (pdfMeasure(t, size, bold) <= maxW || !cur) {
      cur = t
    } else {
      lines.push(cur)
      cur = words[i]
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function pdfTrunc(txt: string, size: number, bold: boolean, maxW: number): string {
  let s = String(txt || '')
  if (pdfMeasure(s, size, bold) <= maxW) return s
  while (s.length && pdfMeasure(`${s}...`, size, bold) > maxW) {
    s = s.slice(0, -1)
  }
  return `${s}...`
}

function pdfEsc(t: any): string {
  return String(t == null ? '' : t)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function pdfBytes(str: string): Uint8Array {
  const a = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    a[i] = c >= 32 && c <= 255 ? c : c === 10 ? 10 : 63
  }
  return a
}

class PCtx {
  s = ''
  imgs: Array<{ bytes: Uint8Array; w: number; h: number }> = []

  op(x: string) {
    this.s += x + '\n'
  }

  line(x1: number, y1: number, x2: number, y2: number, w?: number) {
    this.op(`${w || 0.4} w ${x1.toFixed(1)} ${(PDFH - y1).toFixed(1)} m ${x2.toFixed(1)} ${(PDFH - y2).toFixed(1)} l S`)
  }

  rectS(x: number, y: number, w: number, h: number, lw?: number) {
    this.op(`${lw || 0.4} w ${x.toFixed(1)} ${(PDFH - y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S`)
  }

  fillR(x: number, y: number, w: number, h: number) {
    this.op(`0.851 g ${x.toFixed(1)} ${(PDFH - y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f 0 g`)
  }

  text(txt: string, x: number, base: number, opt?: { size?: number; bold?: boolean; italic?: boolean; align?: 'center' | 'right' | 'left' }) {
    opt = opt || {}
    const size = opt.size || 11
    const f = opt.bold ? '/F2' : opt.italic ? '/F3' : '/F1'
    txt = String(txt == null ? '' : txt)
    if (opt.align === 'center') x -= pdfMeasure(txt, size, !!opt.bold) / 2
    else if (opt.align === 'right') x -= pdfMeasure(txt, size, !!opt.bold)
    this.op(`BT ${f} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${(PDFH - base).toFixed(1)} Tm (${pdfEsc(txt)}) Tj ET`)
  }

  uline(cx: number, y: number, w: number) {
    this.line(cx - w / 2, y, cx + w / 2, y, 0.7)
  }

  image(img: { bytes: Uint8Array; w: number; h: number } | null, x: number, y: number, w: number, h: number) {
    if (!img) return
    const sc = Math.min(w / img.w, h / img.h)
    const dw = img.w * sc
    const dh = img.h * sc
    const dx = x + (w - dw) / 2
    const dy = y + (h - dh) / 2
    const idx = this.imgs.length
    this.imgs.push(img)
    this.op(`q ${dw.toFixed(1)} 0 0 ${dh.toFixed(1)} ${dx.toFixed(1)} ${(PDFH - dy - dh).toFixed(1)} cm /Im${idx} Do Q`)
  }
}

function loadImgEl(src?: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (!src) {
      res(null)
      return
    }
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = src
  })
}

async function sigJPEG(dataUrl?: string): Promise<{ bytes: Uint8Array; w: number; h: number } | null> {
  if (!dataUrl) return null
  const im = await loadImgEl(dataUrl)
  if (!im) return null

  let cv = document.createElement('canvas')
  cv.width = im.naturalWidth || 520
  cv.height = im.naturalHeight || 150
  const cx = cv.getContext('2d')
  if (!cx) return null
  cx.fillStyle = '#ffffff'
  cx.fillRect(0, 0, cv.width, cv.height)
  cx.drawImage(im, 0, 0)

  try {
    const idt = cx.getImageData(0, 0, cv.width, cv.height).data
    let mnx = 1e9,
      mny = 1e9,
      mxx = -1,
      mxy = -1
    for (let py = 0; py < cv.height; py++) {
      for (let px = 0; px < cv.width; px++) {
        const o = (py * cv.width + px) * 4
        if (idt[o] < 235 || idt[o + 1] < 235 || idt[o + 2] < 235) {
          if (px < mnx) mnx = px
          if (px > mxx) mxx = px
          if (py < mny) mny = py
          if (py > mxy) mxy = py
        }
      }
    }
    if (mxx > mnx) {
      mnx = Math.max(0, mnx - 6)
      mny = Math.max(0, mny - 6)
      mxx = Math.min(cv.width - 1, mxx + 6)
      mxy = Math.min(cv.height - 1, mxy + 6)
      const c2 = document.createElement('canvas')
      c2.width = mxx - mnx + 1
      c2.height = mxy - mny + 1
      const c2ctx = c2.getContext('2d')
      if (c2ctx) {
        c2ctx.drawImage(cv, mnx, mny, c2.width, c2.height, 0, 0, c2.width, c2.height)
        cv = c2
      }
    }
  } catch (_) {}

  const bin = atob(cv.toDataURL('image/jpeg', 0.92).split(',')[1])
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return { bytes: arr, w: cv.width, h: cv.height }
}

function mkPDF(pages: Array<{ ctx: PCtx }>): Blob {
  const objs: any[] = []
  function add(body: any) {
    objs.push(body)
    return objs.length
  }
  const fontF1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const fontF2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const fontF3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>')
  const pagesNum = add('')
  const kids: string[] = []

  pages.forEach((pg) => {
    const contentNum = add({ stream: pdfBytes(pg.ctx.s) })
    const imgNums = pg.ctx.imgs.map((im) =>
      add({
        stream: im.bytes,
        dict: `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length `,
      })
    )
    const xo = imgNums.map((n, i) => `/Im${i} ${n} 0 R`).join(' ')
    const pageNum = add(
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PDFW} ${PDFH}] /Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R /F3 ${fontF3} 0 R >> /XObject << ${xo} >> >> /Contents ${contentNum} 0 R >>`
    )
    kids.push(`${pageNum} 0 R`)
  })

  objs[pagesNum - 1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`
  const catalogNum = add(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`)
  const parts: any[] = []
  const offsets: number[] = []
  let pos = 0
  function push(u: any) {
    parts.push(u)
    offsets.push(pos)
    pos += u.length
  }
  function pushStr(s: string) {
    push(pdfBytes(s))
  }
  pushStr('%PDF-1.4\n')
  const objOff: number[] = []
  objs.forEach((body, i) => {
    objOff[i] = pos
    if (typeof body === 'string') {
      pushStr(`${i + 1} 0 obj\n${body}\nendobj\n`)
    } else {
      const dict = body.dict ? body.dict + body.stream.length + ' >>' : `<< /Length ${body.stream.length} >>`
      pushStr(`${i + 1} 0 obj\n${dict}\nstream\n`)
      push(body.stream)
      pushStr('\nendstream\nendobj\n')
    }
  })
  const xrefPos = pos
  let tail = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  objOff.forEach((o) => {
    tail += ('0000000000' + o).slice(-10) + ' 00000 n \n'
  })
  tail += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  pushStr(tail)
  return new Blob(parts, { type: 'application/pdf' })
}

function drawP1(d: PosChuvaRecord): PCtx {
  const c = new PCtx()
  const L = 13,
    R = 582,
    TX = 33.3,
    CX1 = 521.4

  // Título + Revisão
  c.rectS(L, 53, R - L, 38, 1.9)
  c.line(CX1, 53, CX1, 91, 1.9)
  c.line(L, 91, R, 91, 1.2)
  const tcx = (L + CX1) / 2
  c.text('LISTA DE VERIFICAÇÃO', tcx, 71, { size: 10, bold: true, align: 'center' })
  const sub = 'Pós Chuva / Ventos Fortes'
  c.text(sub, tcx, 83.5, { size: 10, bold: true, align: 'center' })
  c.uline(tcx, 84.8, pdfMeasure(sub, 10, true))

  const rcx = (CX1 + R) / 2
  c.text('Revisão:', rcx, 64.5, { size: 10, bold: true, align: 'center' })
  c.text('00/Janeiro', rcx, 76.7, { size: 10, align: 'center' })
  c.text('2024', rcx, 88.9, { size: 10, align: 'center' })

  // Cabeçalho
  const rows: Array<[string, string, number, string, string, number, number]> = [
    ['Empresa:', d.head.empresa, 82, 'Data:', fmtDateBr(d.head.data), 430, 385],
    ['Projeto:', d.head.projeto, 73, 'Nº Contrato:', d.head.contrato, 462, 378],
    ['Auditor:', d.head.auditor, 66, '', '', 0, 0],
    ['Local:', d.head.local, 55, '', '', 0, 0],
    ['Atividade:', d.head.atividade, 76, '', '', 0, 0],
  ]
  const tops = [91, 114.4, 138.3, 162.2, 186.1]
  rows.forEach((rw, i) => {
    const top = tops[i]
    const base = top + 11.5
    c.text(rw[0], 15, base, { size: 10, bold: true })
    if (rw[1]) c.text(pdfTrunc(rw[1], 11, false, (rw[6] ? rw[6] - 8 : R - 6) - rw[2]), rw[2], base, { size: 11 })
    if (rw[3]) {
      c.text(rw[3], rw[6], base, { size: 10, bold: true })
      if (rw[4] && rw[4] !== '—') c.text(pdfTrunc(rw[4], 11, false, R - 6 - rw[5]), rw[5], base, { size: 11 })
    }
    if (i < 4) c.line(L, tops[i + 1], R, tops[i + 1], 0.4)
  })

  // Cabeçalho da lista
  c.line(L, 210, R, 210, 1.9)
  c.fillR(L, 210, R - L, 16.7)
  c.text('Nº', (L + TX) / 2, 223.3, { size: 10, bold: true, align: 'center' })
  c.text('Guia - Lista de Verificação - Pós Chuva / Ventos Fortes', (TX + CX1) / 2, 223.3, { size: 10, bold: true, align: 'center' })
  c.text('C', 531.5, 223.3, { size: 10, bold: true, align: 'center' })
  c.text('NC', 551.8, 223.3, { size: 10, bold: true, align: 'center' })
  c.text('NA', 572, 223.3, { size: 10, bold: true, align: 'center' })
  c.line(L, 226.7, R, 226.7, 0.9)

  // Itens 1-20
  const bounds = [226.7, 255.1, 283.9, 312.7, 341.5, 370.3, 399.1, 427.9, 442.3, 471.1, 499.9, 528.8, 557.6, 586.4, 615.2, 644.0, 672.8, 701.6, 730.4, 759.2, 788.0]
  const colCx: Record<string, number> = { C: 531.5, NC: 551.8, NA: 572 }
  ITEMS.forEach((txt, i) => {
    const top = bounds[i]
    const bot = bounds[i + 1]
    const rh = bot - top
    c.text(String(i + 1), (L + TX) / 2, top + rh / 2 + 3.5, { size: 10, align: 'center' })
    const lines = pdfWrap(txt, 11, false, 481)
    const b0 = lines.length > 1 ? top + 12.5 : rh > 20 ? top + 19.5 : top + 12.5
    lines.slice(0, 2).forEach((ln, j) => {
      c.text(ln, 35.5, b0 + j * 14.6, { size: 11 })
    })
    const v = d.answers[i + 1]
    if (colCx[v]) c.text('X', colCx[v], top + rh / 2 + 4.5, { size: 13, bold: true, align: 'center' })
    if (i < 19) c.line(L, bot, R, bot, 0.4)
  })

  // Bordas da tabela
  c.rectS(L, 210, R - L, 578, 1.9)
  c.line(TX, 210, TX, 788, 1.9)
  c.line(CX1, 210, CX1, 788, 1.9)
  c.line(541.7, 210, 541.7, 788, 0.8)
  c.line(561.9, 210, 561.9, 788, 0.8)
  return c
}

async function drawP2(d: PosChuvaRecord): Promise<PCtx> {
  const c = new PCtx()
  const L = 18.5,
    TR = 558.8,
    SR = 577.1

  // PLANO DE AÇÃO
  c.rectS(L, 72.7, TR - L, 271.2, 1.9)
  c.text('PLANO DE AÇÃO', (L + TR) / 2, 106, { size: 20, bold: true, align: 'center' })
  c.fillR(L, 120.8, TR - L, 19.7)
  c.line(L, 120.8, TR, 120.8, 0.9)
  c.line(L, 140.5, TR, 140.5, 0.9)
  c.text('Item NC', 25.9, 135.5, { size: 8, bold: true })
  c.text('Ação', (63.5 + 339.5) / 2, 136, { size: 10, bold: true, align: 'center' })
  c.text('Responsável', (339.5 + 477.6) / 2, 136, { size: 10, bold: true, align: 'center' })
  c.text('Prazo', (477.6 + TR) / 2, 136, { size: 10, bold: true, align: 'center' })
  c.line(63.5, 120.8, 63.5, 343.9, 1.9)
  c.line(339.5, 120.8, 339.5, 343.9, 1.9)
  c.line(477.6, 120.8, 477.6, 343.9, 1.9)

  const filled = (d.pa || []).filter((r) => r.item || r.acao || r.resp || r.prazo)
  const n = Math.max(7, filled.length)
  const rh = (343.9 - 140.5) / n

  filled.forEach((r, i) => {
    const top = 140.5 + i * rh
    const mid = top + rh / 2 + 3.5
    if (r.item) c.text('Item ' + r.item, (L + 63.5) / 2, mid, { size: 10, bold: true, align: 'center' })
    if (r.acao) {
      const ls = pdfWrap(r.acao, 10, false, 266).slice(0, rh >= 38 ? 3 : 2)
      const b0 = mid - (ls.length - 1) * 5.5
      ls.forEach((ln, j) => c.text(ln, 70, b0 + j * 11, { size: 10 }))
    }
    if (r.resp) {
      const ls2 = pdfWrap(r.resp, 10, false, 128).slice(0, rh >= 38 ? 3 : 2)
      const b1 = mid - (ls2.length - 1) * 5.5
      ls2.forEach((ln, j) => c.text(ln, 346, b1 + j * 11, { size: 10 }))
    }
    if (r.prazo) c.text(fmtDateBr(r.prazo), (477.6 + TR) / 2, mid, { size: 10, align: 'center' })
  })
  for (let ri = 1; ri < n; ri++) c.line(L, 140.5 + ri * rh, TR, 140.5 + ri * rh, 0.4)

  // Assinaturas — 3 avaliações
  const sigImgs: Array<{ bytes: Uint8Array; w: number; h: number } | null> = []
  for (let s = 0; s < (d.sigs || []).length; s++) {
    sigImgs.push(await sigJPEG(d.sigs[s]?.img))
  }

  const barTops = [343.9, 464.6, 585.2]
  for (let ai = 0; ai < 3; ai++) {
    const T = barTops[ai]
    const dataRowBot = T + 57.4
    const lineY = T + 97.6
    const bot = T + 120.7
    c.fillR(L, T, SR - L, 19.7)
    c.line(L, T, SR, T, 1.2)
    c.line(L, T + 19.7, SR, T + 19.7, 0.9)
    c.line(L, dataRowBot, SR, dataRowBot, 0.9)
    c.line(L, bot, SR, bot, 1.2)
    c.text('Assinaturas necessárias para liberação - ' + AVALS[ai], (L + SR) / 2, T + 14.5, { size: 10, bold: true, align: 'center' })

    const s0 = (d.sigs || [])[ai * 2] || {}
    const dstr = s0.data ? fmtDateBr(s0.data) : '___/___/_____'
    const hstr = s0.hora || '___:____'
    c.text('Data  ' + dstr + '   Horário : ' + hstr, (L + SR) / 2, T + 25 + 19.7, { size: 14, align: 'center' })

    for (let rI = 0; rI < 2; rI++) {
      const sg = (d.sigs || [])[ai * 2 + rI] || {}
      const im = sigImgs[ai * 2 + rI]
      const bx = rI === 0 ? 28 : 324
      const bw = rI === 0 ? 234 : 244
      const lx1 = rI === 0 ? 18 : 315.4
      const lx2 = rI === 0 ? 269.1 : 576.4
      const nome = (sg.nome || '').trim()
      if (im) c.image(im, bx, dataRowBot + 1, bw, (nome ? lineY - 14 : lineY - 2) - (dataRowBot + 1))
      if (nome) c.text(pdfTrunc(nome, 11, false, bw), bx + bw / 2, lineY - 5, { size: 11, italic: true, align: 'center' })
      c.line(lx1, lineY, lx2, lineY, 1.6)
    }
    c.text('Ciência do encarregado responsável pela liberação', 20.4, lineY + 21.5, { size: 10 })
    c.text('Ciência do Técnico de Segurança da Contratada', 446, lineY + 21.5, { size: 10, align: 'center' })
  }

  // Observações
  c.fillR(L, 705.8, SR - L, 19.7)
  c.line(L, 705.8, SR, 705.8, 1.2)
  c.text('Observações', (L + SR) / 2, 720.5, { size: 10, bold: true, align: 'center' })
  c.line(L, 72.7, L, 725.5, 1.9)
  let y = 738.5
  const obs = (d.head.observacoes || '').trim()
  if (obs) {
    const ols = pdfWrap(obs, 10, false, 545)
    ols.slice(0, 5).forEach((ln) => {
      c.text(ln, 25, y, { size: 10 })
      y += 13
    })
    y += 4
  }
  c.text('Este formulário será utilizado apenas uma vez por dia. No dia seguinte, um novo formulário deverá ser emitido,', (L + SR) / 2, y, { size: 10, bold: true, align: 'center' })
  y += 12.8
  c.text('acompanhado das respectivas liberações.', (L + SR) / 2, y, { size: 10, bold: true, align: 'center' })
  return c
}

async function baixarPDF(d: PosChuvaRecord): Promise<string> {
  const p1 = drawP1(d)
  const p2 = await drawP2(d)
  const blob = mkPDF([{ ctx: p1 }, { ctx: p2 }])
  const fname = `pos-chuva-${d.head.data ? fmtDateBr(d.head.data).replace(/\//g, '-') : 'relatorio'}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fname
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return fname
}

/* ==========================================================================
   COMPONENTE PRINCIPAL
   ========================================================================== */
function PosChuvaPage() {
  const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const currentUserName = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || '' : ''
  const storageKey = `pos_chuva_verificacoes_${currentEnv}`

  // 1. Cabeçalho
  const [empresa, setEmpresa] = useState('Sucena / Hydro Reabilitação')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [projeto, setProjeto] = useState('')
  const [contrato, setContrato] = useState('')
  const [auditor, setAuditor] = useState(currentUserName)
  const [local, setLocal] = useState('')
  const [atividade, setAtividade] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // 2. Respostas dos 20 itens
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [missHighlight, setMissHighlight] = useState<number[]>([])

  // 3. Plano de Ação
  const [paList, setPaList] = useState<PlanoAcaoItem[]>([
    { id: 'pa-1', item: '', acao: '', resp: '', prazo: '' },
  ])

  // 4. Assinaturas (3 avaliações x 2 papéis = 6 assinaturas)
  // Estrutura: { [key: string]: { nome: string, img: string, data: string, hora: string } }
  const [sigMeta, setSigMeta] = useState<Record<string, { nome: string; img: string; data: string; hora: string }>>(() => {
    const init: Record<string, { nome: string; img: string; data: string; hora: string }> = {}
    AVALS.forEach((_, ai) => {
      ROLES.forEach((r) => {
        init[`av${ai}-${r.k}`] = { nome: '', img: '', data: '', hora: '' }
      })
    })
    return init
  })

  // Canvas refs para desenho
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const isDrawingRef = useRef<Record<string, boolean>>({})

  // 5. Histórico e feedback
  const [records, setRecords] = useState<PosChuvaRecord[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [registroExibido, setRegistroExibido] = useState<PosChuvaRecord | null>(null)

  // Carregar histórico do Supabase / LocalStorage
  useEffect(() => {
    const carregar = async () => {
      try {
        const { data: dbData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle()

        if (dbData?.value) {
          const parsed = typeof dbData.value === 'string' ? JSON.parse(dbData.value) : dbData.value
          if (Array.isArray(parsed)) {
            setRecords(parsed)
            return
          }
        }

        const local = localStorage.getItem(storageKey)
        if (local) {
          setRecords(JSON.parse(local))
        }
      } catch (err) {
        console.warn('[PosChuva] Erro ao carregar dados:', err)
      }
    }

    carregar()

    const channel = supabase
      .channel('pos_chuva_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: `key=eq.${storageKey}` },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value)) {
            setRecords(payload.new.value)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storageKey])

  // Inicializar pads de assinatura com eventos de toque e mouse
  const attachPadEvents = (id: string, cv: HTMLCanvasElement) => {
    const ctx = cv.getContext('2d')
    if (!ctx) return

    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'

    const pos = (e: MouseEvent | TouchEvent) => {
      const r = cv.getBoundingClientRect()
      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY
      const x = clientX - r.left
      const y = clientY - r.top
      return {
        x: x * (cv.width / r.width),
        y: y * (cv.height / r.height),
      }
    }

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      isDrawingRef.current[id] = true
      const p = pos(e)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
    }

    const move = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current[id]) return
      e.preventDefault()
      const p = pos(e)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }

    const end = () => {
      if (isDrawingRef.current[id]) {
        isDrawingRef.current[id] = false
        const imgData = cv.toDataURL('image/png')
        setSigMeta((prev) => ({
          ...prev,
          [id]: { ...prev[id], img: imgData },
        }))
      }
    }

    cv.addEventListener('mousedown', start)
    cv.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)

    cv.addEventListener('touchstart', start, { passive: false })
    cv.addEventListener('touchmove', move, { passive: false })
    cv.addEventListener('touchend', end)
  }

  const limparAssinatura = (id: string) => {
    const cv = canvasRefs.current[id]
    if (cv) {
      const ctx = cv.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, cv.width, cv.height)
      }
    }
    setSigMeta((prev) => ({
      ...prev,
      [id]: { ...prev[id], img: '' },
    }))
  }

  // Contadores
  const counts = useMemo(() => {
    let c = 0,
      nc = 0,
      na = 0
    const miss: number[] = []
    ITEMS.forEach((_, idx) => {
      const val = answers[idx + 1]
      if (val === 'C') c++
      else if (val === 'NC') nc++
      else if (val === 'NA') na++
      else miss.push(idx + 1)
    })
    return { c, nc, na, miss, done: c + nc + na }
  }, [answers])

  // Plano de Ação helpers
  const handleAddPa = (itemNc = '') => {
    setPaList((prev) => [
      ...prev,
      { id: `pa-${Date.now()}-${Math.random()}`, item: itemNc, acao: '', resp: '', prazo: '' },
    ])
  }

  const handleGenPa = () => {
    const existing: Record<string, boolean> = {}
    paList.forEach((p) => {
      if (p.item) existing[p.item] = true
    })
    const ncItems: string[] = []
    Object.keys(answers).forEach((k) => {
      const n = Number(k)
      if (answers[n] === 'NC' && !existing[String(n)]) {
        ncItems.push(String(n))
      }
    })

    if (ncItems.length === 0) {
      setSaveError('⚠️ Nenhuma linha nova gerada: ou não há itens NC selecionados, ou todos os itens NC já têm linha no Plano de Ação.')
      return
    }

    setSaveError(null)
    setPaList((prev) => [
      ...prev.filter((p) => p.item || p.acao || p.resp || p.prazo),
      ...ncItems.map((n) => ({
        id: `pa-${Date.now()}-${n}`,
        item: n,
        acao: '',
        resp: '',
        prazo: '',
      })),
    ])
    toast.success(`${ncItems.length} linha(s) de item NC gerada(s) no Plano de Ação!`)
  }

  const handleRemovePa = (id: string) => {
    setPaList((prev) => (prev.length <= 1 ? [{ id: 'pa-1', item: '', acao: '', resp: '', prazo: '' }] : prev.filter((p) => p.id !== id)))
  }

  // Coleta dos dados atuais do formulário
  const getCurrentData = (): PosChuvaRecord => {
    const sigsArray: AssinaturaAvaliacao[] = []
    AVALS.forEach((av, ai) => {
      ROLES.forEach((r) => {
        const k = `av${ai}-${r.k}`
        const m = sigMeta[k] || { nome: '', img: '', data: '', hora: '' }
        sigsArray.push({
          aval: av,
          role: r.t,
          key: k,
          nome: m.nome,
          img: m.img,
          data: m.data,
          hora: m.hora,
        })
      })
    })

    return {
      id: `poschuva-${Date.now()}`,
      savedAt: new Date().toLocaleString('pt-BR'),
      head: {
        empresa: empresa.trim(),
        data,
        projeto: projeto.trim(),
        contrato: contrato.trim(),
        auditor: auditor.trim(),
        local: local.trim(),
        atividade: atividade.trim(),
        observacoes: observacoes.trim(),
        revisao: '00 / Janeiro 2024',
      },
      answers: { ...answers },
      pa: paList.filter((p) => p.item || p.acao || p.resp || p.prazo),
      sigs: sigsArray,
    }
  }

  // Salvar no Supabase
  const handleSalvar = async () => {
    setSaveError(null)
    setSaveSuccess(null)

    const problems: string[] = []
    if (!empresa.trim()) problems.push('preencha a EMPRESA')
    if (!data) problems.push('preencha a DATA')
    if (!auditor.trim()) problems.push('preencha o AUDITOR')
    if (!local.trim()) problems.push('preencha o LOCAL')

    if (counts.miss.length > 0) {
      problems.push(`responda todos os itens — faltam ${counts.miss.length}: ${counts.miss.join(', ')}`)
      setMissHighlight(counts.miss)
    } else {
      setMissHighlight([])
    }

    if (problems.length > 0) {
      const msg = `⚠️ NÃO FOI POSSÍVEL SALVAR — falta:\n• ${problems.join('\n• ')}`
      setSaveError(msg)
      const el = document.getElementById('erro-salvamento')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const novoRegistro = getCurrentData()
    const novosRegistros = [novoRegistro, ...records]
    setRecords(novosRegistros)

    try {
      localStorage.setItem(storageKey, JSON.stringify(novosRegistros))
    } catch (_) {}

    try {
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', storageKey)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('global_settings')
          .update({ value: novosRegistros })
          .eq('key', storageKey)
      } else {
        await supabase
          .from('global_settings')
          .insert({ key: storageKey, value: novosRegistros })
      }

      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Lista de Verificação Pós Chuva salva para ${fmtDateBr(data)} (Local: ${local})`,
        user_name: currentUserName || auditor || 'Segurança',
        environment: currentEnv,
      })

      const okMsg = `✅ VERIFICAÇÃO SALVA! Registrada como Lista de Verificação Pós Chuva / Ventos Fortes de ${fmtDateBr(data)} — C: ${counts.c}, NC: ${counts.nc}, NA: ${counts.na}. O relatório automático já foi atualizado.`
      setSaveSuccess(okMsg)
      setRegistroExibido(novoRegistro)
      toast.success('✅ Verificação Pós Chuva salva com sucesso!')

      const relEl = document.getElementById('secao-relatorio')
      if (relEl) relEl.scrollIntoView({ behavior: 'smooth' })
    } catch (err: any) {
      console.error('Erro ao persistir verificação no Supabase:', err)
      toast.error('Salvo localmente, erro ao sincronizar no servidor.')
    }
  }

  // Limpar formulário
  const handleLimpar = () => {
    setAnswers({})
    setMissHighlight([])
    setProjeto('')
    setContrato('')
    setLocal('')
    setAtividade('')
    setObservacoes('')
    setPaList([{ id: 'pa-1', item: '', acao: '', resp: '', prazo: '' }])
    AVALS.forEach((_, ai) => {
      ROLES.forEach((r) => {
        limparAssinatura(`av${ai}-${r.k}`)
      })
    })
    setSaveError(null)
    setSaveSuccess(null)
    setRegistroExibido(null)
    toast.info('Formulário limpo!')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Copiar relatório em texto
  const handleCopiarTexto = () => {
    const d = registroExibido || getCurrentData()
    const lines: string[] = []
    lines.push('RELATÓRIO — LISTA DE VERIFICAÇÃO PÓS CHUVA / VENTOS FORTES')
    lines.push(`Empresa: ${d.head.empresa || '—'} | Data: ${fmtDateBr(d.head.data)} | Projeto: ${d.head.projeto || '—'} | Nº Contrato: ${d.head.contrato || '—'}`)
    lines.push(`Auditor: ${d.head.auditor || '—'} | Local: ${d.head.local || '—'} | Atividade: ${d.head.atividade || '—'} | Revisão: ${d.head.revisao}`)
    lines.push(`Totais — C: ${counts.c} | NC: ${counts.nc} | NA: ${counts.na} | Sem resposta: ${counts.miss.length}`)
    lines.push('')
    lines.push('RESULTADO ITEM POR ITEM:')
    ITEMS.forEach((t, i) => lines.push(`${i + 1}. [${d.answers[i + 1] || 'SEM RESPOSTA'}] ${t}`))
    lines.push('')
    lines.push('ITENS NC — PENDENTES:')
    let anyNc = false
    ITEMS.forEach((t, i) => {
      if (d.answers[i + 1] === 'NC') {
        anyNc = true
        lines.push(`Item ${i + 1}: ${t}`)
      }
    })
    if (!anyNc) lines.push('Nenhum item NC.')
    lines.push('')
    lines.push('PLANO DE AÇÃO:')
    if (d.pa.length) {
      d.pa.forEach((r) => lines.push(`- Item NC ${r.item || '—'}: ${r.acao || '—'} | Responsável: ${r.resp || '—'} | Prazo: ${fmtDateBr(r.prazo)}`))
    } else {
      lines.push('Não preenchido.')
    }
    if (d.head.observacoes) {
      lines.push('')
      lines.push(`Observações: ${d.head.observacoes}`)
    }
    lines.push('')
    lines.push('ASSINATURAS PARA LIBERAÇÃO:')
    d.sigs.forEach((s) => {
      lines.push(`- ${s.aval} — ${s.role}: ${s.nome || '(nome não preenchido)'}${s.img ? ' (assinatura desenhada)' : ' (sem assinatura desenhada)'}${s.data ? ` | Data: ${fmtDateBr(s.data)}` : ''}${s.hora ? ` | Horário: ${s.hora}` : ''}`)
    })
    lines.push('')
    lines.push('Observação do PDF: Este formulário será utilizado apenas uma vez por dia. No dia seguinte, um novo formulário deverá ser emitido, acompanhado das respectivas liberações.')

    const txt = lines.join('\n')
    navigator.clipboard.writeText(txt).then(() => {
      setCopySuccess('✅ Relatório copiado! Agora é só colar no WhatsApp, e-mail ou onde precisar.')
      toast.success('Relatório copiado para a área de transferência!')
    })
  }

  // Baixar PDF do formulário atual
  const handleBaixarPdfAtual = async () => {
    setGerandoPdf(true)
    setPdfSuccess(null)
    try {
      const d = registroExibido || getCurrentData()
      const fname = await baixarPDF(d)
      setPdfSuccess(`✅ PDF baixado: ${fname} — 2 páginas no formato original da Lista de Verificação Pós Chuva / Ventos Fortes, preenchido com os dados, os X nos itens, o plano de ação, as assinaturas e as observações.`)
      toast.success('PDF gerado e baixado com sucesso!')
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err)
      toast.error('Erro ao gerar PDF: ' + (err?.message || err))
    } finally {
      setGerandoPdf(false)
    }
  }

  // Dados para exibição no relatório
  const dadosRelatorio = registroExibido || getCurrentData()
  const percentualC = counts.done > 0 ? Math.round((counts.c / 20) * 100) : 0
  const itensNc = useMemo(() => {
    const list: Array<{ n: number; t: string }> = []
    ITEMS.forEach((t, i) => {
      if (dadosRelatorio.answers[i + 1] === 'NC') list.push({ n: i + 1, t })
    })
    return list
  }, [dadosRelatorio.answers])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 pt-4 px-3 sm:px-6 max-w-6xl mx-auto">
      {/* Topo / Migalha de Pão */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
          <Link to="/seguranca" className="flex items-center gap-1 hover:text-amber-600 transition">
            <ArrowLeft className="w-4 h-4" /> Segurança
          </Link>
          <span>›</span>
          <strong className="text-black font-extrabold">Pós Chuva</strong>
        </div>

        <span className="text-xs font-bold text-gray-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
          HYDRO REABILITAÇÃO · Revisão: 00/Janeiro 2024
        </span>
      </div>

      {/* Título Principal */}
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight flex items-center gap-2">
          <Droplets className="w-8 h-8 text-blue-600 inline" /> Pós Chuva
        </h1>
        <p className="text-sm font-semibold text-gray-800 mt-1.5 leading-relaxed max-w-3xl">
          <strong>LISTA DE VERIFICAÇÃO — Pós Chuva / Ventos Fortes.</strong> Preencha o cabeçalho, selecione apenas{' '}
          <strong>C, NC ou NA</strong> em cada item, preencha manualmente o plano de ação e as observações, salve, assine
          e gere o relatório em PDF com exatamente 2 páginas conforme o documento oficial.
        </p>
      </div>

      {/* SEÇÃO 1: CABEÇALHO */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-black text-black uppercase tracking-wide flex items-center gap-2 mb-1">
          📋 Cabeçalho — conforme o PDF
        </h2>
        <p className="text-xs font-bold text-gray-700 mb-4">
          Campos do cabeçalho da Lista de Verificação Pós Chuva / Ventos Fortes. Revisão do formulário: <strong>00 / Janeiro 2024</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Empresa *
            </label>
            <input
              type="text"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex.: Sucena / Hydro Reabilitação"
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Data *
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black outline-hidden bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Projeto
            </label>
            <input
              type="text"
              value={projeto}
              onChange={(e) => setProjeto(e.target.value)}
              placeholder="Nome do projeto"
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Nº Contrato
            </label>
            <input
              type="text"
              value={contrato}
              onChange={(e) => setContrato(e.target.value)}
              placeholder="Número do contrato"
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Auditor *
            </label>
            <input
              type="text"
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
              placeholder="Nome do auditor"
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Local *
            </label>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Local / frente de trabalho"
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
              Atividade
            </label>
            <input
              type="text"
              value={atividade}
              onChange={(e) => setAtividade(e.target.value)}
              placeholder="Atividade verificada"
              className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
            />
          </div>
        </div>

        <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl text-xs font-bold text-gray-900 leading-relaxed">
          <strong>Observações do PDF:</strong> Este formulário será utilizado apenas uma vez por dia. No dia seguinte, um novo formulário deverá ser emitido, acompanhado das respectivas liberações.
        </div>
      </section>

      {/* SEÇÃO 2: OS 20 ITENS DE VERIFICAÇÃO */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-black text-black uppercase tracking-wide flex items-center gap-2 mb-1">
          ✅ Lista de Verificação — Pós Chuva / Ventos Fortes
        </h2>
        <p className="text-xs font-bold text-gray-700 mb-4">
          Selecione somente uma opção por item: <strong>C</strong> = Conforme • <strong>NC</strong> = Não Conforme • <strong>NA</strong> = Não se Aplica.
        </p>

        {/* Estatísticas no topo da lista */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-black">20</span>
            <span className="text-[11px] font-extrabold uppercase text-gray-700 tracking-wider">Itens no PDF</span>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-green-700">{counts.c}</span>
            <span className="text-[11px] font-extrabold uppercase text-green-800 tracking-wider">Conforme (C)</span>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-red-600">{counts.nc}</span>
            <span className="text-[11px] font-extrabold uppercase text-red-800 tracking-wider">Não Conforme (NC)</span>
          </div>

          <div className="bg-gray-100 border border-gray-300 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-gray-800">{counts.na}</span>
            <span className="text-[11px] font-extrabold uppercase text-gray-800 tracking-wider">Não se Aplica (NA)</span>
          </div>
        </div>

        {/* Indicador de pendências */}
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <span className="block text-sm font-black text-black">
            {counts.miss.length > 0 ? (
              <span className="text-amber-800">
                ⏳ Faltam responder {counts.miss.length} item(s): {counts.miss.join(', ')}
              </span>
            ) : (
              <span className="text-green-700">✅ Todos os 20 itens respondidos!</span>
            )}
          </span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Progresso da verificação</span>
        </div>

        {/* Cabeçalho da tabela */}
        <div className="hidden sm:grid grid-cols-[44px_1fr_210px] gap-2.5 items-center font-black uppercase text-xs tracking-wider text-black p-2.5 bg-amber-100/70 border border-amber-200 rounded-xl mb-2">
          <div className="text-center">Nº</div>
          <div>Guia — Lista de Verificação — Pós Chuva / Ventos Fortes</div>
          <div className="text-center flex justify-around">
            <span>C</span>
            <span>NC</span>
            <span>NA</span>
          </div>
        </div>

        {/* Linhas dos 20 Itens */}
        <div className="space-y-2">
          {ITEMS.map((txt, idx) => {
            const num = idx + 1
            const val = answers[num]
            const isNc = val === 'NC'
            const isMiss = missHighlight.includes(num)

            return (
              <div
                key={num}
                id={`row-${num}`}
                className={`grid grid-cols-1 sm:grid-cols-[44px_1fr_210px] gap-2.5 items-center p-3 rounded-xl border transition-all ${
                  isNc
                    ? 'border-red-500 bg-red-50/70'
                    : isMiss
                    ? 'border-red-500 ring-2 ring-red-200 bg-red-50/40'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-center font-black text-base text-black flex items-center justify-between sm:justify-center">
                  <span>{num}</span>
                  <span className="sm:hidden text-xs font-bold uppercase text-gray-500">Item #{num}</span>
                </div>

                <div className="text-[14.5px] font-semibold text-black leading-snug">{txt}</div>

                <div className="flex items-center gap-1.5 w-full">
                  {/* Botão C */}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`item-${num}`}
                      value="C"
                      checked={val === 'C'}
                      onChange={() => {
                        setAnswers((prev) => ({ ...prev, [num]: 'C' }))
                        setMissHighlight((prev) => prev.filter((m) => m !== num))
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`block text-center py-2 px-1 rounded-lg font-black text-xs transition border ${
                        val === 'C'
                          ? 'bg-green-600 border-green-600 text-white shadow-xs'
                          : 'bg-white border-gray-400 text-black hover:bg-gray-50'
                      }`}
                    >
                      C
                    </span>
                  </label>

                  {/* Botão NC */}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`item-${num}`}
                      value="NC"
                      checked={val === 'NC'}
                      onChange={() => {
                        setAnswers((prev) => ({ ...prev, [num]: 'NC' }))
                        setMissHighlight((prev) => prev.filter((m) => m !== num))
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`block text-center py-2 px-1 rounded-lg font-black text-xs transition border ${
                        val === 'NC'
                          ? 'bg-red-600 border-red-600 text-white shadow-xs'
                          : 'bg-white border-gray-400 text-black hover:bg-gray-50'
                      }`}
                    >
                      NC
                    </span>
                  </label>

                  {/* Botão NA */}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`item-${num}`}
                      value="NA"
                      checked={val === 'NA'}
                      onChange={() => {
                        setAnswers((prev) => ({ ...prev, [num]: 'NA' }))
                        setMissHighlight((prev) => prev.filter((m) => m !== num))
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`block text-center py-2 px-1 rounded-lg font-black text-xs transition border ${
                        val === 'NA'
                          ? 'bg-gray-700 border-gray-700 text-white shadow-xs'
                          : 'bg-white border-gray-400 text-black hover:bg-gray-50'
                      }`}
                    >
                      NA
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* SEÇÃO 3: PLANO DE AÇÃO */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-black text-black uppercase tracking-wide flex items-center gap-2 mb-1">
          🛠️ PLANO DE AÇÃO
        </h2>
        <p className="text-xs font-bold text-gray-700 mb-3">
          Preenchimento manual, conforme o PDF — para cada item <strong>NC</strong>: qual é o item, a ação, o responsável e o prazo.
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-xl mb-3">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white uppercase text-[11px] tracking-wider font-extrabold">
                <th className="p-2.5 w-32">Item NC</th>
                <th className="p-2.5">Ação</th>
                <th className="p-2.5 w-48">Responsável</th>
                <th className="p-2.5 w-36">Prazo</th>
                <th className="p-2.5 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paList.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50">
                  <td className="p-2">
                    <select
                      value={row.item}
                      onChange={(e) => {
                        const val = e.target.value
                        setPaList((prev) =>
                          prev.map((p) => (p.id === row.id ? { ...p, item: val } : p))
                        )
                      }}
                      className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-lg p-2 font-bold text-black bg-white"
                    >
                      <option value="">Item NC</option>
                      {ITEMS.map((_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Item {i + 1}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2">
                    <input
                      type="text"
                      value={row.acao}
                      onChange={(e) => {
                        const val = e.target.value
                        setPaList((prev) =>
                          prev.map((p) => (p.id === row.id ? { ...p, acao: val } : p))
                        )
                      }}
                      placeholder="Ação a ser feita"
                      className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-lg p-2 font-bold text-black placeholder:text-gray-600 bg-white"
                    />
                  </td>

                  <td className="p-2">
                    <input
                      type="text"
                      value={row.resp}
                      onChange={(e) => {
                        const val = e.target.value
                        setPaList((prev) =>
                          prev.map((p) => (p.id === row.id ? { ...p, resp: val } : p))
                        )
                      }}
                      placeholder="Responsável"
                      className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-lg p-2 font-bold text-black placeholder:text-gray-600 bg-white"
                    />
                  </td>

                  <td className="p-2">
                    <input
                      type="date"
                      value={row.prazo}
                      onChange={(e) => {
                        const val = e.target.value
                        setPaList((prev) =>
                          prev.map((p) => (p.id === row.id ? { ...p, prazo: val } : p))
                        )
                      }}
                      className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-lg p-2 font-bold text-black bg-white"
                    />
                  </td>

                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemovePa(row.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition"
                      title="Excluir linha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button
            type="button"
            onClick={() => handleAddPa('')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-black text-xs font-black rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" /> Adicionar linha
          </button>

          <button
            type="button"
            onClick={handleGenPa}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-100 border-1.5 border-gray-400 text-black text-xs font-black rounded-xl transition shadow-xs"
          >
            Gerar linhas dos itens NC selecionados
          </button>
        </div>

        <div>
          <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Escreva aqui as observações da verificação..."
            rows={3}
            className="w-full border-1.5 border-gray-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200 rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-black placeholder:text-gray-700 placeholder:opacity-100 placeholder:font-semibold outline-hidden bg-white"
          />
        </div>
      </section>

      {/* SEÇÃO 4: ASSINATURAS PARA LIBERAÇÃO */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-black text-black uppercase tracking-wide flex items-center gap-2 mb-1">
          ✍️ Assinaturas necessárias para liberação
        </h2>
        <p className="text-xs font-bold text-gray-700 mb-4">
          Conforme o PDF: <strong>Primeira, Segunda e Terceira avaliação</strong> — cada uma com a ciência do encarregado responsável pela liberação e a ciência do Técnico de Segurança da Contratada, com data e horário.
        </p>

        <div className="space-y-6">
          {AVALS.map((av, ai) => (
            <div key={av} className="border-t-3 border-amber-400 pt-3">
              <h3 className="text-base font-black text-black mb-3">
                Assinaturas necessárias para liberação — {av}
              </h3>

              {/* Data e Horário da Avaliação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                    Data — {av}
                  </label>
                  <input
                    type="date"
                    value={sigMeta[`av${ai}-enc`]?.data || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setSigMeta((prev) => ({
                        ...prev,
                        [`av${ai}-enc`]: { ...prev[`av${ai}-enc`], data: val },
                        [`av${ai}-tec`]: { ...prev[`av${ai}-tec`], data: val },
                      }))
                    }}
                    className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3.5 py-2 text-[14px] font-bold text-black bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                    Horário — {av}
                  </label>
                  <input
                    type="time"
                    value={sigMeta[`av${ai}-enc`]?.hora || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setSigMeta((prev) => ({
                        ...prev,
                        [`av${ai}-enc`]: { ...prev[`av${ai}-enc`], hora: val },
                        [`av${ai}-tec`]: { ...prev[`av${ai}-tec`], hora: val },
                      }))
                    }}
                    className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3.5 py-2 text-[14px] font-bold text-black bg-white"
                  />
                </div>
              </div>

              {/* Grid das 2 Assinaturas (Encarregado e Técnico) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ROLES.map((r) => {
                  const id = `av${ai}-${r.k}`
                  const meta = sigMeta[id] || { nome: '', img: '', data: '', hora: '' }

                  return (
                    <div key={id} className="border-1.5 border-gray-300 rounded-2xl p-4 bg-gray-50/60 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-black text-black mb-1">{r.t}</h4>
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Assine no quadro abaixo e/ou preencha o nome.
                        </p>

                        <label className="block text-[11px] font-black text-black uppercase tracking-wider mb-1">
                          Nome
                        </label>
                        <input
                          type="text"
                          value={meta.nome}
                          onChange={(e) => {
                            const val = e.target.value
                            setSigMeta((prev) => ({
                              ...prev,
                              [id]: { ...prev[id], nome: val },
                            }))
                          }}
                          placeholder="Nome de quem assina"
                          className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 bg-white mb-2"
                        />

                        {/* Canvas de Assinatura */}
                        <div className="relative">
                          <canvas
                            ref={(el) => {
                              if (el && !canvasRefs.current[id]) {
                                canvasRefs.current[id] = el
                                attachPadEvents(id, el)
                              }
                            }}
                            id={`${id}-pad`}
                            width={520}
                            height={150}
                            className="w-full h-36 bg-white border-2 border-dashed border-gray-700 rounded-xl cursor-crosshair touch-none block"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => limparAssinatura(id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-400 text-black text-xs font-bold rounded-lg transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Limpar assinatura
                        </button>
                        {meta.img && (
                          <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            Assinatura capturada
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 5: SALVAR VERIFICAÇÃO & HISTÓRICO */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-black text-black uppercase tracking-wide flex items-center gap-2 mb-1">
          💾 Salvar a verificação
        </h2>
        <p className="text-xs font-bold text-gray-700 mb-4">
          Ao salvar, a verificação fica registrada no banco de dados e o relatório automático é atualizado com tudo o que foi preenchido.
        </p>

        {/* Mensagem de Erro */}
        {saveError && (
          <div
            id="erro-salvamento"
            className="mb-4 bg-red-50 border-2 border-red-600 border-l-8 border-l-red-600 rounded-xl p-4 text-red-900 font-bold text-sm whitespace-pre-line leading-relaxed"
          >
            {saveError}
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {saveSuccess && (
          <div className="mb-4 bg-green-50 border-2 border-green-600 border-l-8 border-l-green-600 rounded-xl p-4 text-green-950 font-black text-sm leading-relaxed">
            {saveSuccess}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSalvar}
            className="inline-flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-500 text-black text-sm font-black rounded-xl transition shadow-md"
          >
            💾 Salvar verificação
          </button>

          <button
            type="button"
            onClick={handleLimpar}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-gray-100 border-1.5 border-gray-400 text-black text-sm font-black rounded-xl transition shadow-xs"
          >
            <RotateCcw className="w-4 h-4" /> Limpar formulário
          </button>
        </div>

        {/* Histórico de Verificações Salvas */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-base font-black text-black mb-3">
            Verificações salvas neste ambiente ({records.length})
          </h3>

          {records.length === 0 ? (
            <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-xs font-semibold text-gray-500">
              Nenhuma verificação salva ainda.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {records.map((rec) => {
                let c = 0,
                  nc = 0,
                  na = 0
                Object.values(rec.answers || {}).forEach((v) => {
                  if (v === 'C') c++
                  else if (v === 'NC') nc++
                  else if (v === 'NA') na++
                })

                return (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50/50 flex items-center justify-between gap-3 flex-wrap text-xs font-semibold"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-black text-black">
                          {fmtDateBr(rec.head.data)} — {rec.head.local || 'Local não informado'}
                        </strong>
                        <span className="text-[11px] text-gray-600">
                          Auditor: <strong className="text-gray-900">{rec.head.auditor || '—'}</strong>
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-2">
                        <span className="text-green-700 font-bold">C: {c}</span> •{' '}
                        <span className="text-red-600 font-bold">NC: {nc}</span> •{' '}
                        <span className="text-gray-700 font-bold">NA: {na}</span> •{' '}
                        <span>Salva em: {rec.savedAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setRegistroExibido(rec)
                          const el = document.getElementById('secao-relatorio')
                          if (el) el.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs transition"
                      >
                        Ver no relatório
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            toast.info('Gerando PDF...')
                            await baixarPDF(rec)
                            toast.success('PDF baixado!')
                          } catch (err: any) {
                            toast.error('Erro ao baixar PDF: ' + err?.message)
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-xs transition inline-flex items-center gap-1"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Baixar PDF
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 6: RELATÓRIO AUTOMÁTICO */}
      <section id="secao-relatorio" className="bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-lg font-black text-black uppercase tracking-wide flex items-center gap-2">
            📋 Relatório Automático — Pós Chuva / Ventos Fortes
          </h2>
          {registroExibido && (
            <span className="text-xs font-bold text-green-800 bg-green-100 border border-green-300 px-2.5 py-0.5 rounded-full">
              Exibindo registro salvo ({fmtDateBr(registroExibido.head.data)})
            </span>
          )}
        </div>

        <p className="text-xs font-bold text-gray-700 mb-4">
          Gerado e atualizado automaticamente a cada seleção, preenchimento, assinatura e salvamento. Para exportar, use o botão{' '}
          <strong>⬇️ Baixar relatório em PDF (formato original)</strong> para obter as 2 páginas oficiais idênticas ao modelo de papel.
        </p>

        {/* Resumo Cabeçalho */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900 leading-relaxed mb-4">
          <div>
            <strong>Empresa:</strong> {dadosRelatorio.head.empresa || '—'} &nbsp;|&nbsp;{' '}
            <strong>Data:</strong> {fmtDateBr(dadosRelatorio.head.data)} &nbsp;|&nbsp;{' '}
            <strong>Projeto:</strong> {dadosRelatorio.head.projeto || '—'} &nbsp;|&nbsp;{' '}
            <strong>Nº Contrato:</strong> {dadosRelatorio.head.contrato || '—'}
          </div>
          <div className="mt-1">
            <strong>Auditor:</strong> {dadosRelatorio.head.auditor || '—'} &nbsp;|&nbsp;{' '}
            <strong>Local:</strong> {dadosRelatorio.head.local || '—'} &nbsp;|&nbsp;{' '}
            <strong>Atividade:</strong> {dadosRelatorio.head.atividade || '—'} &nbsp;|&nbsp;{' '}
            <strong>Revisão:</strong> {dadosRelatorio.head.revisao}
          </div>
        </div>

        {/* Cards de Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-green-700">{counts.c}</span>
            <span className="text-[11px] font-extrabold uppercase text-green-800">Conforme (C)</span>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-red-600">{counts.nc}</span>
            <span className="text-[11px] font-extrabold uppercase text-red-800">Não Conforme (NC)</span>
          </div>

          <div className="bg-gray-100 border border-gray-300 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-gray-800">{counts.na}</span>
            <span className="text-[11px] font-extrabold uppercase text-gray-800">Não se Aplica (NA)</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-amber-800">{20 - counts.done}</span>
            <span className="text-[11px] font-extrabold uppercase text-amber-800">Sem resposta</span>
          </div>
        </div>

        {/* Barra de Progresso de Conformidade */}
        <div className="mb-4">
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-green-600 transition-all duration-300" style={{ width: `${percentualC}%` }} />
          </div>
          <p className="text-xs font-black text-black">
            {percentualC}% dos itens CONFORMES (sobre os 20 itens do PDF)
          </p>
        </div>

        {/* Resultado Item por Item */}
        <div className="mb-4">
          <h3 className="text-sm font-black text-black mb-2">Resultado item por item:</h3>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border border-gray-200 rounded-xl p-2 bg-gray-50/50">
            {ITEMS.map((txt, idx) => {
              const num = idx + 1
              const val = dadosRelatorio.answers[num] || 'SEM RESPOSTA'
              const cor = val === 'C' ? 'text-green-700' : val === 'NC' ? 'text-red-600' : 'text-gray-700'

              return (
                <div key={num} className="text-xs font-semibold py-1 border-b border-gray-200 last:border-0 flex items-start gap-1.5">
                  <span className="font-bold text-gray-900">{num}.</span>
                  <span className="flex-1 text-gray-800">{txt}</span>
                  <span className={`font-black uppercase ml-2 ${cor}`}>[{val}]</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Itens NC / Pendências */}
        <div className="mb-4">
          <h3 className="text-sm font-black text-black mb-1.5">
            ⚠️ Itens NC — pendentes / Plano de Ação:
          </h3>
          {itensNc.length === 0 ? (
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-900">
              Nenhum item NC. Nenhuma pendência na verificação.
            </div>
          ) : (
            <div className="space-y-1.5 border border-red-200 bg-red-50/50 rounded-xl p-2.5">
              {itensNc.map((x) => (
                <div key={x.n} className="text-xs font-bold text-red-900">
                  <strong>Item {x.n}:</strong> {x.t}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plano de Ação Preenchido */}
        {dadosRelatorio.pa.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-black text-black mb-1.5">Plano de Ação preenchido:</h3>
            <div className="space-y-1 border border-gray-200 rounded-xl p-2.5 bg-gray-50">
              {dadosRelatorio.pa.map((r, i) => (
                <div key={i} className="text-xs font-semibold text-gray-800">
                  • <strong>Item NC:</strong> {r.item || '—'} — <strong>Ação:</strong> {r.acao || '—'} —{' '}
                  <strong>Responsável:</strong> {r.resp || '—'} — <strong>Prazo:</strong> {fmtDateBr(r.prazo)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observações */}
        {dadosRelatorio.head.observacoes && (
          <div className="mb-4">
            <h3 className="text-sm font-black text-black mb-1">Observações:</h3>
            <p className="text-xs font-semibold text-gray-800 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
              {dadosRelatorio.head.observacoes}
            </p>
          </div>
        )}

        {/* Assinaturas Renderizadas */}
        <div className="mb-5">
          <h3 className="text-sm font-black text-black mb-2">✍️ Assinaturas para liberação:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dadosRelatorio.sigs.map((s, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold">
                <div className="font-black text-black">
                  {s.aval} — {s.role}
                </div>
                <div className="text-gray-700 mt-0.5">
                  Nome: <strong>{s.nome || '(não preenchido)'}</strong>
                  {s.data && <span> · Data: {fmtDateBr(s.data)}</span>}
                  {s.hora && <span> · Hora: {s.hora}</span>}
                </div>
                {s.img ? (
                  <div className="mt-2 bg-white border border-gray-300 rounded-lg p-1 w-fit">
                    <img src={s.img} alt="Assinatura" className="max-h-16 max-w-[200px] object-contain" />
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 block mt-1">
                    (assinatura não desenhada)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ações do Relatório: Baixar PDF e Copiar */}
        <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-gray-200">
          <button
            type="button"
            disabled={gerandoPdf}
            onClick={handleBaixarPdfAtual}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-black text-white text-sm font-black rounded-xl transition shadow-md disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            {gerandoPdf ? '⏳ Gerando PDF...' : '⬇️ Baixar relatório em PDF (formato original)'}
          </button>

          <button
            type="button"
            onClick={handleCopiarTexto}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-gray-100 border-1.5 border-gray-400 text-black text-sm font-black rounded-xl transition shadow-xs"
          >
            <Copy className="w-4 h-4" /> Copiar relatório (texto)
          </button>
        </div>

        {copySuccess && (
          <div className="mt-3 bg-green-50 border border-green-500 p-3 rounded-xl text-xs font-bold text-green-900">
            {copySuccess}
          </div>
        )}

        {pdfSuccess && (
          <div className="mt-3 bg-green-50 border border-green-500 p-3 rounded-xl text-xs font-bold text-green-900">
            {pdfSuccess}
          </div>
        )}
      </section>
    </div>
  )
}
