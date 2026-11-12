-- ============================================================
-- Migração: Tabela dedicada para vínculos Colaborador × Equipamento Pesado
-- Referência: feat/cracha-vinculado-tabela-dedicada
-- ============================================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.eq_cracha_vinculos (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  environment   text          NOT NULL DEFAULT 'barcarena',
  motorista_id  uuid          NOT NULL,  -- FK para rh_efetivo.id
  equipamento_id uuid         NOT NULL,  -- FK para eq_equipments.id
  created_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (environment, motorista_id, equipamento_id)
);

-- 2. Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_eq_cracha_vinculos_env         ON public.eq_cracha_vinculos (environment);
CREATE INDEX IF NOT EXISTS idx_eq_cracha_vinculos_motorista   ON public.eq_cracha_vinculos (motorista_id);
CREATE INDEX IF NOT EXISTS idx_eq_cracha_vinculos_equipamento ON public.eq_cracha_vinculos (equipamento_id);

-- 3. RLS: habilitar e liberar para usuários autenticados
ALTER TABLE public.eq_cracha_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_authenticated_read" ON public.eq_cracha_vinculos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "allow_authenticated_insert" ON public.eq_cracha_vinculos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "allow_authenticated_delete" ON public.eq_cracha_vinculos
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- NOTA: Execute este SQL no painel SQL do Supabase.
-- A migração dos dados do global_settings é feita automaticamente
-- pelo código na primeira vez que a tela for carregada
-- (função migrarVinculosLegados em crachaVinculado.ts).
-- ============================================================
