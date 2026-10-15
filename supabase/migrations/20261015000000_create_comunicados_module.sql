-- ============================================================
--  MÓDULO COMUNICADOS
--  Avisos exibidos dentro do sistema, com controle por usuário
--  e por dia (periodicidade, limite diário e janela de exibição).
--
--  Este script é idempotente: pode ser executado mais de uma vez
--  sem erro. Basta colar todo o conteúdo no SQL Editor do Supabase.
--
--  Pré-requisito: a função public.is_admin(uuid) precisa existir
--  (criada em supabase_admin.sql). As policies dependem dela.
-- ============================================================

-- ============================================================
-- 1. COMUNICADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  -- NULL = enviar para todos os usuários
  destino_usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  periodicidade TEXT NOT NULL DEFAULT 'unica'
    CHECK (periodicidade IN ('unica', 'diaria', 'todo_dia')),
  -- Quantidade de exibições por dia (usado em 'unica' e 'diaria')
  vezes_por_dia INTEGER NOT NULL DEFAULT 1
    CHECK (vezes_por_dia >= 1 AND vezes_por_dia <= 100),
  -- Duração da janela em segundos
  duracao_segundos INTEGER NOT NULL DEFAULT 15
    CHECK (duracao_segundos BETWEEN 1 AND 3600),
  -- Data/hora de início da janela de exibição
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIME NOT NULL DEFAULT TIME '00:00:00',
  -- Data/hora final. NULL = sem expiração
  data_fim DATE,
  -- Quando TRUE, ignora a janela de data/hora e exibe assim que
  -- o usuário abrir o sistema (respeitando periodicidade e limite).
  imediato BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicados_ativo
  ON public.comunicados (ativo, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_comunicados_destino
  ON public.comunicados (destino_usuario_id);

-- ============================================================
-- 2. MÍDIAS DO COMUNICADO
--    video | foto | audio | youtube
--    'audio' sempre vem acompanhado de uma imagem de capa.
--    'youtube' guarda apenas o ID do vídeo em storage_path
--    (não há upload: o vídeo é reproduzido via embed).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comunicado_midias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id UUID NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('video', 'foto', 'audio', 'youtube')),
  -- Caminho dentro do bucket (não a URL pública).
  -- Para 'youtube': o ID de 11 caracteres do vídeo.
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  -- Para tipo 'audio': imagem de capa exibida junto ao player
  capa_path TEXT,
  duracao_segundos INTEGER,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicado_midias_comunicado
  ON public.comunicado_midias (comunicado_id, ordem);

-- ============================================================
-- 3. CONTROLE DE EXIBIÇÕES (uma linha por usuário/dia/exibição)
--    Garante o limite diário e permite bloquear reabertura
--    dentro da mesma sessão.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comunicado_exibicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id UUID NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Dia local no formato YYYY-MM-DD
  dia TEXT NOT NULL,
  exibicao_numero INTEGER NOT NULL,
  -- Identificador da sessão, para não reabrir na mesma sessão
  session_key TEXT,
  modo_fechamento TEXT CHECK (modo_fechamento IN ('manual', 'automatico')),
  exibido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_em TIMESTAMPTZ
);

-- Impede duas exibições do mesmo comunicado/usuário/dia/ocorrência
CREATE UNIQUE INDEX IF NOT EXISTS uq_comunicado_exibicao_unica
  ON public.comunicado_exibicoes (comunicado_id, user_id, dia, exibicao_numero);

CREATE INDEX IF NOT EXISTS idx_comunicado_exibicoes_user_dia
  ON public.comunicado_exibicoes (user_id, dia);

-- ============================================================
-- 4. BUCKET DE MÍDIA
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comunicados_midia', 'comunicados_midia', true, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (as mídias são exibidas via <img>/<video>)
DROP POLICY IF EXISTS "comunicados_midia_public_read" ON storage.objects;
CREATE POLICY "comunicados_midia_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'comunicados_midia');

-- Upload apenas por administradores
DROP POLICY IF EXISTS "comunicados_midia_admin_upload" ON storage.objects;
CREATE POLICY "comunicados_midia_admin_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comunicados_midia' AND public.is_admin(auth.uid()));

-- Remoção apenas por administradores
DROP POLICY IF EXISTS "comunicados_midia_admin_delete" ON storage.objects;
CREATE POLICY "comunicados_midia_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comunicados_midia' AND public.is_admin(auth.uid()));

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_exibicoes ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas o destinatário ou todos (destino NULL).
-- Administradores enxergam tudo.
DROP POLICY IF EXISTS "comunicados_select_elegiveis" ON public.comunicados;
CREATE POLICY "comunicados_select_elegiveis" ON public.comunicados
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR destino_usuario_id IS NULL
    OR destino_usuario_id = auth.uid()
  );

-- Escrita: somente administradores
DROP POLICY IF EXISTS "comunicados_admin_insert" ON public.comunicados;
CREATE POLICY "comunicados_admin_insert" ON public.comunicados
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "comunicados_admin_update" ON public.comunicados;
CREATE POLICY "comunicados_admin_update" ON public.comunicados
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "comunicados_admin_delete" ON public.comunicados;
CREATE POLICY "comunicados_admin_delete" ON public.comunicados
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Mídias: leitura junto com o comunicado
DROP POLICY IF EXISTS "comunicado_midias_select_elegiveis" ON public.comunicado_midias;
CREATE POLICY "comunicado_midias_select_elegiveis" ON public.comunicado_midias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.comunicados c
      WHERE c.id = comunicado_id
        AND (
          public.is_admin(auth.uid())
          OR c.destino_usuario_id IS NULL
          OR c.destino_usuario_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "comunicado_midias_admin_write" ON public.comunicado_midias;
CREATE POLICY "comunicado_midias_admin_write" ON public.comunicado_midias
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Exibições: cada usuário vê e registra apenas as suas
DROP POLICY IF EXISTS "comunicado_exibicoes_own" ON public.comunicado_exibicoes;
CREATE POLICY "comunicado_exibicoes_own" ON public.comunicado_exibicoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6. FUNÇÃO: maior dia com timezone do Brasil
-- ============================================================

CREATE OR REPLACE FUNCTION public.comunicado_current_day()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(now() AT TIME ZONE 'America/Belem', 'YYYY-MM-DD');
$$;

-- ============================================================
-- 7. RPC: retorna os comunicados elegíveis para o usuário,
--    respeitando janela de exibição, destinatário e limite diário.
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
  -- Compara sempre em horário local de Brasília
  v_agora := now() AT TIME ZONE 'America/Belem';

  RETURN QUERY
  WITH exibicoes AS (
    SELECT
      c.id AS comunicado_id,
      count(e.id)::int AS total_exibidas,
      -- exibido ao menos uma vez nesta sessão?
      bool_or(e.session_key IS NOT NULL AND e.session_key = p_session_key) AS na_sessao
    FROM public.comunicados c
    LEFT JOIN public.comunicado_exibicoes e
      ON e.comunicado_id = c.id
     AND e.user_id = p_user_id
     AND e.dia = v_dia
    WHERE c.ativo = TRUE
      -- Destinatário: geral ou o próprio usuário
      AND (c.destino_usuario_id IS NULL OR c.destino_usuario_id = p_user_id)
      -- Janela de datas. "imediato" ignora data/hora e expiração.
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
    c.id,
    c.descricao,
    c.periodicidade,
    CASE WHEN c.periodicidade = 'todo_dia' THEN 999 ELSE c.vezes_por_dia END AS vezes_por_dia,
    c.duracao_segundos,
    c.data_inicio,
    c.hora_inicio,
    c.data_fim,
    c.destino_usuario_id,
    x.total_exibidas,
    CASE WHEN c.periodicidade = 'todo_dia' THEN 999 ELSE c.vezes_por_dia END AS total_permitidas,
    COALESCE(x.na_sessao, false) AS ja_exibido_na_sessao
  FROM public.comunicados c
  JOIN exibicoes x ON x.comunicado_id = c.id
  WHERE
    -- 'todo_dia': uma vez por sessão, sem limite diário
    (c.periodicidade = 'todo_dia' AND COALESCE(x.na_sessao, false) = false)
    OR
    -- 'unica' e 'diaria': respeitam o limite de vezes_por_dia
    (c.periodicidade IN ('unica', 'diaria') AND x.total_exibidas < c.vezes_por_dia);
END;
$$;

-- ============================================================
-- 8. RPC: registra a exibição
-- ============================================================

CREATE OR REPLACE FUNCTION public.comunicado_registrar_exibicao(
  p_comunicado_id UUID,
  p_dia TEXT DEFAULT NULL,
  p_session_key TEXT DEFAULT NULL
)
RETURNS public.comunicado_exibicoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia TEXT;
  v_total INTEGER;
  v_limite INTEGER;
  v_numero INTEGER;
  v_result public.comunicado_exibicoes;
BEGIN
  v_dia := COALESCE(p_dia, public.comunicado_current_day());

  IF NOT EXISTS (
    SELECT 1 FROM public.comunicados c
    WHERE c.id = p_comunicado_id
      AND c.ativo = TRUE
      AND (c.destino_usuario_id IS NULL OR c.destino_usuario_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Comunicado indisponível para este usuário.';
  END IF;

  -- Modo 'todo_dia' só registra 1 por dia/sessão, sem contador diário
  SELECT
    CASE WHEN periodicidade = 'todo_dia' THEN 1 ELSE vezes_por_dia END
  INTO v_limite
  FROM public.comunicados WHERE id = p_comunicado_id;

  SELECT count(*)::int INTO v_total
  FROM public.comunicado_exibicoes
  WHERE comunicado_id = p_comunicado_id
    AND user_id = auth.uid()
    AND dia = v_dia;

  IF v_total >= v_limite THEN
    RAISE EXCEPTION 'Limite diário de exibições atingido para este comunicado.';
  END IF;

  SELECT COALESCE(max(exibicao_numero), 0) + 1 INTO v_numero
  FROM public.comunicado_exibicoes
  WHERE comunicado_id = p_comunicado_id
    AND user_id = auth.uid()
    AND dia = v_dia;

  INSERT INTO public.comunicado_exibicoes (
    comunicado_id, user_id, dia, exibicao_numero, session_key
  ) VALUES (
    p_comunicado_id, auth.uid(), v_dia, v_numero, p_session_key
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 9. RPC: registra o fechamento (manual ou automático)
-- ============================================================

CREATE OR REPLACE FUNCTION public.comunicado_registrar_fechamento(
  p_exibicao_id UUID,
  p_modo TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_modo NOT IN ('manual', 'automatico') THEN
    RAISE EXCEPTION 'Modo de fechamento inválido.';
  END IF;

  UPDATE public.comunicado_exibicoes
  SET fechado_em = now(),
      modo_fechamento = p_modo
  WHERE id = p_exibicao_id
    AND user_id = auth.uid()
    AND fechado_em IS NULL;
END;
$$;