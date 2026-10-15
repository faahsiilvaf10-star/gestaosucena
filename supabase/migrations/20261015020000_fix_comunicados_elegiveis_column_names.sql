-- ============================================================
--  CORREÇÃO: nomes de saída explícitos na RPC comunicados_elegiveis
--
--  A versão anterior retornava as colunas por posição. Ao adicionar
--  colunas na tabela ao longo do tempo, a posição deixou de bater com
--  a assinatura RETURNS TABLE e o modal recebia duracao_segundos = 15
--  (o DEFAULT) em vez do valor gravado — a lista mostrava 60s e o
--  modal fechava em 15s.
--
--  Esta versão nomeia todas as colunas do SELECT, eliminando a
--  dependência de ordem posicional. É idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.comunicados_elegiveis(
  p_user_id UUID,
  p_dia TEXT DEFAULT NULL,
  p_session_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  descricao TEXT,
  periodicidade TEXT,
  vezes_por_dia INTEGER,
  duracao_segundos INTEGER,
  data_inicio DATE,
  hora_inicio TIME,
  data_fim DATE,
  destino_usuario_id UUID,
  ja_exibidas INTEGER,
  total_permitidas INTEGER,
  ja_exibido_na_sessao BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia TEXT;
  v_agora TIMESTAMP;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: usuário inválido.';
  END IF;

  v_dia := COALESCE(p_dia, public.comunicado_current_day());
  v_agora := now() AT TIME ZONE 'America/Belem';

  RETURN QUERY
  WITH exibicoes AS (
    SELECT
      c.id AS comunicado_id,
      count(e.id)::int AS total_exibidas,
      bool_or(e.session_key IS NOT NULL AND e.session_key = p_session_key) AS na_sessao
    FROM public.comunicados c
    LEFT JOIN public.comunicado_exibicoes e
      ON e.comunicado_id = c.id
     AND e.user_id = p_user_id
     AND e.dia = v_dia
    WHERE c.ativo = TRUE
      AND (c.destino_usuario_id IS NULL OR c.destino_usuario_id = p_user_id)
      AND (
        c.imediato = TRUE
        OR (
          c.data_inicio <= v_dia::date
          AND (c.data_fim IS NULL OR c.data_fim >= v_dia::date)
          AND (v_dia::date > c.data_inicio OR v_agora::time >= c.hora_inicio)
        )
      )
    GROUP BY c.id
  )
  SELECT
    c.id AS id,
    c.descricao AS descricao,
    c.periodicidade AS periodicidade,
    (CASE WHEN c.periodicidade = 'todo_dia' THEN 999 ELSE c.vezes_por_dia END)::integer AS vezes_por_dia,
    c.duracao_segundos::integer AS duracao_segundos,
    c.data_inicio AS data_inicio,
    c.hora_inicio AS hora_inicio,
    c.data_fim AS data_fim,
    c.destino_usuario_id AS destino_usuario_id,
    x.total_exibidas::integer AS ja_exibidas,
    (CASE WHEN c.periodicidade = 'todo_dia' THEN 999 ELSE c.vezes_por_dia END)::integer AS total_permitidas,
    COALESCE(x.na_sessao, false) AS ja_exibido_na_sessao
  FROM public.comunicados c
  JOIN exibicoes x ON x.comunicado_id = c.id
  WHERE
    (c.periodicidade = 'todo_dia' AND COALESCE(x.na_sessao, false) = false)
    OR
    (c.periodicidade IN ('unica', 'diaria') AND x.total_exibidas < c.vezes_por_dia);
END;
$$;
