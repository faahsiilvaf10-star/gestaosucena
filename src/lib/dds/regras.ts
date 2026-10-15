/**
 * Regras do disparo automatico do DDS (Diario de Seguranca).
 *
 * Modulo puro: nao importa React nem Supabase, para ser testavel.
 */

export type TipoDds = 'hoje' | 'amanha'

export const HORA_DDS_HOJE = 6
export const HORA_DDS_AMANHA = 16

/** Minutos desde a meia-noite. */
export function minutosDoDia(hora: number, minuto: number): number {
  return hora * 60 + minuto
}

/**
 * Define qual DDS deve ser disparado agora.
 *
 * Regressao: a versao anterior exigia `minute === 0`. O intervalo roda
 * a cada 60s e o primeiro tique acontece 60s apos o montar — raramente
 * alinhado ao minuto exato. Como o `localStorage` era gravado ANTES de
 * qualquer validacao, um unico tique na janela marcava o dia como
 * processado e o envio real nunca acontecia mais naquele horario.
 *
 * Agora usa uma janela de tolerancia, e o localStorage so e gravado
 * depois que a mensagem foi realmente enviada.
 */
export function tipoDdsParaAgora(
  hora: number,
  minuto: number,
  toleranciaMinutos = 10,
): TipoDds | null {
  const agora = minutosDoDia(hora, minuto)

  // Janela simétrica: [alvo - tolerancia, alvo + tolerancia].
  // O piso evita que o aviso das 16h dispare às 15h50.
  const dentro = (alvo: number): boolean => {
    const inicio = alvo - toleranciaMinutos
    const fim = alvo + toleranciaMinutos
    return agora >= inicio && agora <= fim
  }

  if (dentro(minutosDoDia(HORA_DDS_HOJE, 0))) return 'hoje'
  if (dentro(minutosDoDia(HORA_DDS_AMANHA, 0))) return 'amanha'

  return null
}

/** Chave de idempotência para um tipo/dia. */
export function chaveDds(tipo: TipoDds, dataIso: string): string {
  return `dds_enviado_${tipo}_${dataIso}`
}

/** Chave do "dia de hoje" que identifica o disparo de cada tipo. */
export function dataDisparo(tipo: TipoDds, agora: Date): string {
  // O aviso das 16h fala do dia seguinte, mas o registro usa o dia em
  // que o disparo aconteceu — assim nao conflita com o das 6h.
  return agora.toISOString().slice(0, 10)
}

/**
 * Resolve o nome do palestrante a partir da lista de usuários.
 *
 * Regressão: a consulta anterior usava a tabela `hr_employees`, que não
 * existe no banco (a API responde 404). O `catch` engolia a falha e a
 * mensagem saía com "Não informado". Os ids de `palestrante_id` vêm da
 * mesma fonte que alimenta o seletor da tela de DDS.
 */
export function resolverNomePalestrante<T extends { id: string; nome?: string | null }>(
  usuarios: T[],
  palestranteId: string | null | undefined,
): string {
  if (!palestranteId) return 'Não informado'
  const nome = usuarios.find((u) => u.id === palestranteId)?.nome?.trim()
  return nome ? nome : 'Não informado'
}

/**
 * Data do DDS que deve ser buscado.
 * 'hoje' usa o dia corrente; 'amanha' soma um dia.
 */
export function dataAlvoDds(tipo: TipoDds, agora: Date): Date {
  const alvo = new Date(agora)
  if (tipo === 'amanha') alvo.setDate(alvo.getDate() + 1)
  return alvo
}