import { useCallback, useEffect, useState } from 'react'
import Crown from 'lucide-react/dist/esm/icons/crown.js'
import Medal from 'lucide-react/dist/esm/icons/medal.js'
import Trophy from 'lucide-react/dist/esm/icons/trophy.js'
import { buscarRanking, type ModoJogo, type Pontuacao } from '../../lib/cacaPalavras'

interface Props {
  modo?: ModoJogo
  userId?: string
  /** Chave que, ao mudar, força a atualização do ranking. */
  atualizarEm?: number
}

const MEDALHAS = [
  { cor: 'from-amber-300 to-amber-500', anel: 'ring-amber-400/60', texto: 'text-amber-300', icone: Crown },
  { cor: 'from-slate-200 to-slate-400', anel: 'ring-slate-300/60', texto: 'text-slate-200', icone: Medal },
  { cor: 'from-orange-400 to-orange-700', anel: 'ring-orange-500/60', texto: 'text-orange-300', icone: Medal },
]

function formatarTempo(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const min = Math.floor(total / 60)
  const seg = total % 60
  return `${min}:${String(seg).padStart(2, '0')}`
}

export function PainelRanking({ modo, userId, atualizarEm = 0 }: Props) {
  const [ranking, setRanking] = useState<Pontuacao[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const dados = await buscarRanking(modo)
    setRanking(dados)
    setCarregando(false)
  }, [modo])

  useEffect(() => {
    void carregar()
  }, [carregar, atualizarEm])

  const top3 = ranking.slice(0, 3)
  const resto = ranking.slice(3)

  if (carregando) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-slate-900/50" />
        ))}
      </div>
    )
  }

  if (ranking.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-500" />
        <p className="text-sm font-semibold text-slate-900">Nenhuma pontuação registrada ainda</p>
        <p className="mt-1 text-xs text-slate-600 font-medium">Jogue uma partida solo ou online para inaugurar o ranking dos 3 primeiros.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pódio 1-2-3 */}
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {[top3[1], top3[0], top3[2]].map((pontuacao, indice) => {
          if (!pontuacao) {
            return <div key={`vazio-${indice}`} className="h-24 rounded-2xl border border-dashed border-white/10 bg-slate-900/30" />
          }
          const lugar = indice === 0 ? 2 : indice === 1 ? 1 : 3
          const medalha = MEDALHAS[lugar - 1]
          const Icone = medalha.icone
          const altura = lugar === 1 ? 'pb-8 pt-10' : lugar === 2 ? 'pb-5 pt-6' : 'pb-3 pt-5'
          const souEu = pontuacao.user_id === userId

          return (
            <div
              key={`${pontuacao.id}-${lugar}`}
              className={`animate-[role-fade-in_0.5s_ease-out] rounded-2xl border bg-gradient-to-b ${medalha.cor} ${medalha.anel} ${altura} relative overflow-hidden border-white/10 text-center shadow-lg`}
              style={{ animationDelay: `${indice * 120}ms` }}
            >
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10" />
              <Icone className={`mx-auto mb-1 h-6 w-6 ${medalha.texto} drop-shadow`} />
              <p className="truncate px-2 text-sm font-black text-white drop-shadow">{pontuacao.user_name}</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-white drop-shadow">{pontuacao.score}</p>
              <span className="mt-1 inline-block rounded-full bg-black/25 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white/90">
                {lugar}º lugar
              </span>
              {souEu && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[0.55rem] font-bold text-white shadow">
                  VOCÊ
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Demais posições */}
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
                      souEu ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3.5 py-2.5 font-bold tabular-nums text-slate-500">{indice + 4}</td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">
                      {pontuacao.user_name}
                      {souEu && <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-400">VOCÊ</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs uppercase text-slate-600 font-semibold">{pontuacao.modo}</td>
                    <td className="hidden px-3.5 py-2.5 text-xs tabular-nums text-slate-600 font-medium sm:table-cell">
                      {pontuacao.fase}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs tabular-nums text-slate-600 font-medium">{formatarTempo(pontuacao.tempo_ms)}</td>
                    <td className="px-3.5 py-2.5 text-right font-black tabular-nums text-amber-700">
                      {pontuacao.score}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
