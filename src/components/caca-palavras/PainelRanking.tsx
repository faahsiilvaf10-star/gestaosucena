import { useCallback, useEffect, useMemo, useState } from 'react'
import Crown from 'lucide-react/dist/esm/icons/crown.js'
import Medal from 'lucide-react/dist/esm/icons/medal.js'
import Trophy from 'lucide-react/dist/esm/icons/trophy.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Filter from 'lucide-react/dist/esm/icons/filter.js'
import UserCheck from 'lucide-react/dist/esm/icons/user-check.js'
import { buscarRanking, type ModoJogo, type Pontuacao } from '../../lib/cacaPalavras'

interface Props {
  modo?: ModoJogo
  userId?: string
  /** Chave que, ao mudar, força a atualização do ranking. */
  atualizarEm?: number
}

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MEDALHAS = [
  { cor: 'from-amber-400 to-amber-600', anel: 'ring-amber-400/60', texto: 'text-amber-100', icone: Crown, label: '1º Lugar' },
  { cor: 'from-slate-300 to-slate-500', anel: 'ring-slate-300/60', texto: 'text-slate-100', icone: Medal, label: '2º Lugar' },
  { cor: 'from-orange-400 to-orange-700', anel: 'ring-orange-400/60', texto: 'text-orange-100', icone: Medal, label: '3º Lugar' },
]

function formatarTempo(ms: number) {
  if (!ms) return '0:00'
  const total = Math.max(0, Math.round(ms / 1000))
  const min = Math.floor(total / 60)
  const seg = total % 60
  return `${min}:${String(seg).padStart(2, '0')}`
}

function obterMesesDisponiveis() {
  const agora = new Date()
  const meses = []

  // Mês atual
  const anoAtual = agora.getFullYear()
  const mesAtual = agora.getMonth()
  const chaveAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`
  meses.push({
    chave: chaveAtual,
    rotulo: `${NOMES_MESES[mesAtual]} / ${anoAtual} (Atual)`,
  })

  // Mês anterior
  const dataAnterior = new Date(anoAtual, mesAtual - 1, 1)
  const anoAnt = dataAnterior.getFullYear()
  const mesAnt = dataAnterior.getMonth()
  const chaveAnt = `${anoAnt}-${String(mesAnt + 1).padStart(2, '0')}`
  meses.push({
    chave: chaveAnt,
    rotulo: `${NOMES_MESES[mesAnt]} / ${anoAnt}`,
  })

  // Dois meses atrás
  const dataAnt2 = new Date(anoAtual, mesAtual - 2, 1)
  const anoAnt2 = dataAnt2.getFullYear()
  const mesAnt2 = dataAnt2.getMonth()
  const chaveAnt2 = `${anoAnt2}-${String(mesAnt2 + 1).padStart(2, '0')}`
  meses.push({
    chave: chaveAnt2,
    rotulo: `${NOMES_MESES[mesAnt2]} / ${anoAnt2}`,
  })

  // Todo o período
  meses.push({
    chave: 'todos',
    rotulo: 'Geral (Todo o Histórico)',
  })

  return meses
}

export function PainelRanking({ modo: modoProp, userId, atualizarEm = 0 }: Props) {
  const mesesDisponiveis = useMemo(() => obterMesesDisponiveis(), [])
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesesDisponiveis[0].chave)
  const [modoFiltro, setModoFiltro] = useState<string>(modoProp || 'todos')

  const [ranking, setRanking] = useState<Pontuacao[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const modoParam = modoFiltro === 'todos' ? undefined : (modoFiltro as ModoJogo)
    const dados = await buscarRanking(modoParam, mesSelecionado)
    setRanking(dados)
    setCarregando(false)
  }, [modoFiltro, mesSelecionado])

  useEffect(() => {
    void carregar()
  }, [carregar, atualizarEm])

  // Desempenho do usuário logado
  const meuMelhor = useMemo(() => {
    if (!userId || ranking.length === 0) return null
    const index = ranking.findIndex((p) => p.user_id === userId)
    if (index === -1) return null
    return {
      posicao: index + 1,
      pontuacao: ranking[index],
    }
  }, [ranking, userId])

  const top3 = ranking.slice(0, 3)
  const resto = ranking.slice(3)

  return (
    <div className="space-y-5">
      {/* Barra de Filtros: Mês e Modo */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        {/* Filtro por Mês */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mês:</span>
          <select
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 cursor-pointer shadow-xs"
          >
            {mesesDisponiveis.map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Modo */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Modo:</span>
          <select
            value={modoFiltro}
            onChange={(e) => setModoFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
          >
            <option value="todos">Todos os Modos</option>
            <option value="busca">Caça-Palavras Solo</option>
            <option value="cruzada">Palavras Cruzadas Solo</option>
            <option value="online">Online 1x1</option>
          </select>
        </div>
      </div>

      {/* Destaque: Desempenho do Usuário */}
      {meuMelhor && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white font-black text-sm shadow-xs">
              #{meuMelhor.posicao}
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-amber-600" /> Seu Melhor Desempenho no Período
              </p>
              <p className="text-xs text-amber-800 font-medium">
                Você está na <b className="font-black text-amber-950">{meuMelhor.posicao}ª posição</b> com{' '}
                <b className="font-black text-amber-950">{meuMelhor.pontuacao.score} pts</b> no modo{' '}
                <span className="uppercase font-bold">{meuMelhor.pontuacao.modo}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-amber-700">{meuMelhor.pontuacao.score} pts</span>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : ranking.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-bold text-slate-800">Nenhuma pontuação registrada neste mês</p>
          <p className="mt-1 text-xs text-slate-600 font-medium">
            Jogue uma partida solo ou desafie um colega no 1x1 para inaugurar o ranking deste mês!
          </p>
        </div>
      ) : (
        <>
          {/* Pódio Top 3 */}
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 pt-2">
            {[top3[1], top3[0], top3[2]].map((pontuacao, indice) => {
              const lugar = indice === 0 ? 2 : indice === 1 ? 1 : 3
              if (!pontuacao) {
                return (
                  <div
                    key={`vazio-${indice}`}
                    className="h-28 rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-bold"
                  >
                    {lugar}º Lugar
                  </div>
                )
              }
              const medalha = MEDALHAS[lugar - 1]
              const Icone = medalha.icone
              const altura = lugar === 1 ? 'pb-7 pt-9' : lugar === 2 ? 'pb-5 pt-6' : 'pb-3 pt-5'
              const souEu = pontuacao.user_id === userId

              return (
                <div
                  key={`${pontuacao.id}-${lugar}`}
                  className={`rounded-2xl bg-gradient-to-b ${medalha.cor} ${medalha.anel} ${altura} relative overflow-hidden text-center shadow-md text-white transition-transform hover:scale-[1.02]`}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
                  <Icone className={`mx-auto mb-1 h-6 w-6 ${medalha.texto} drop-shadow`} />
                  <p className="truncate px-2 text-sm font-black drop-shadow">{pontuacao.user_name}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums drop-shadow">{pontuacao.score} pts</p>
                  <span className="mt-1 inline-block rounded-full bg-black/25 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                    {medalha.label}
                  </span>
                  {souEu && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[0.55rem] font-black text-white shadow">
                      VOCÊ
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Demais posições (4º em diante) */}
          {resto.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[0.65rem] uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left font-bold">#</th>
                    <th className="px-3.5 py-2.5 text-left font-bold">Jogador</th>
                    <th className="px-3.5 py-2.5 text-left font-bold">Modo</th>
                    <th className="hidden px-3.5 py-2.5 text-left font-bold sm:table-cell">Fase</th>
                    <th className="px-3.5 py-2.5 text-left font-bold">Tempo</th>
                    <th className="px-3.5 py-2.5 text-right font-bold">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resto.map((pontuacao, indice) => {
                    const souEu = pontuacao.user_id === userId
                    return (
                      <tr
                        key={pontuacao.id ?? `${pontuacao.user_id}-${indice}`}
                        className={`transition-colors ${
                          souEu ? 'bg-amber-50/70 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-bold tabular-nums text-slate-500">
                          {indice + 4}º
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">
                          {pontuacao.user_name}
                          {souEu && (
                            <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-800">
                              VOCÊ
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs uppercase text-slate-600 font-semibold">
                          {pontuacao.modo}
                        </td>
                        <td className="hidden px-3.5 py-2.5 text-xs tabular-nums text-slate-600 font-medium sm:table-cell">
                          {pontuacao.fase}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs tabular-nums text-slate-600 font-medium">
                          {formatarTempo(pontuacao.tempo_ms)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-black tabular-nums text-amber-700">
                          {pontuacao.score} pts
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
