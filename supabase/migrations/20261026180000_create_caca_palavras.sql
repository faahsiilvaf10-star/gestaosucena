-- =====================================================================
-- Migração: Caça Palavras & Palavras Cruzadas (Pontuações, Presença e 1x1)
-- =====================================================================

-- 1. Tabela de pontuações / ranking
CREATE TABLE IF NOT EXISTS public.caca_palavras_scores (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    avatar_url TEXT,
    modo TEXT NOT NULL, -- 'busca', 'cruzada', 'online'
    fase INT NOT NULL DEFAULT 1,
    nivel INT NOT NULL DEFAULT 1,
    score INT NOT NULL DEFAULT 0,
    tempo_ms INT NOT NULL DEFAULT 0,
    palavras_found INT NOT NULL DEFAULT 0,
    total_palavras INT NOT NULL DEFAULT 0,
    vitoria BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caca_palavras_scores_modo_score
    ON public.caca_palavras_scores(modo, score DESC, tempo_ms ASC);

CREATE INDEX IF NOT EXISTS idx_caca_palavras_scores_user
    ON public.caca_palavras_scores(user_id);

ALTER TABLE public.caca_palavras_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ler pontuacoes"
    ON public.caca_palavras_scores FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Qualquer autenticado pode inserir pontuacao propria"
    ON public.caca_palavras_scores FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 2. Tabela de presença de jogadores online
CREATE TABLE IF NOT EXISTS public.caca_palavras_players (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    avatar_url TEXT,
    online BOOLEAN NOT NULL DEFAULT true,
    pontos INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.caca_palavras_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ver jogadores online"
    ON public.caca_palavras_players FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Usuario gerencia sua propria presenca"
    ON public.caca_palavras_players FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Tabela de partidas 1x1
CREATE TABLE IF NOT EXISTS public.caca_palavras_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL UNIQUE,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    modo TEXT NOT NULL,
    fase_atual INT NOT NULL DEFAULT 1,
    semente BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta', -- 'aberta', 'em_andamento', 'finalizada'
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caca_palavras_matches_codigo
    ON public.caca_palavras_matches(codigo);

ALTER TABLE public.caca_palavras_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ver partidas"
    ON public.caca_palavras_matches FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Qualquer autenticado pode criar partidas"
    ON public.caca_palavras_matches FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host pode atualizar sua partida"
    ON public.caca_palavras_matches FOR UPDATE TO authenticated
    USING (auth.uid() = host_id)
    WITH CHECK (auth.uid() = host_id);

-- 4. Jogadores da partida 1x1
CREATE TABLE IF NOT EXISTS public.caca_palavras_match_players (
    match_id UUID NOT NULL REFERENCES public.caca_palavras_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    fase INT NOT NULL DEFAULT 1,
    palavras_found INT NOT NULL DEFAULT 0,
    terminou BOOLEAN NOT NULL DEFAULT false,
    vitorioso BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (match_id, user_id)
);

ALTER TABLE public.caca_palavras_match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ler progresso de partidas"
    ON public.caca_palavras_match_players FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Jogador pode atualizar seu proprio progresso"
    ON public.caca_palavras_match_players FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
