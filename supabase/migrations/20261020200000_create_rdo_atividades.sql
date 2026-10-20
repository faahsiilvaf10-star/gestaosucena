-- ====================================================================================
-- MIGRATION: Criar tabela de atividades customizadas do RDO
-- ====================================================================================

-- Tabela de atividades customizadas do RDO
CREATE TABLE IF NOT EXISTS public.rdo_atividades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id TEXT,                          -- ID da obra (ambiente)
    data DATE NOT NULL,                    -- Data da atividade
    titulo TEXT NOT NULL,                  -- Título livre (ex: "Jardinagem", "Gabião")
    icon TEXT DEFAULT 'Activity',          -- Nome do ícone Lucide
    area TEXT,                             -- Área (ex: "Área Jardinagem", "Área Gabião")
    quantidade DECIMAL(10,2),              -- Quantidade
    metragem DECIMAL(10,2),               -- Metragem
    unidade TEXT,                          -- Unidade de medida (m, m², m³, un, etc)
    descricao TEXT,                        -- Descrição adicional
    observacoes TEXT,                      -- Observações
    concluido BOOLEAN DEFAULT FALSE,       -- Marcação de conclusão
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID                        -- Usuário que criou
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_data ON public.rdo_atividades(data);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_obra_data ON public.rdo_atividades(obra_id, data);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_area ON public.rdo_atividades(area);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.update_rdo_atividades_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rdo_atividades_updated_at ON public.rdo_atividades;
CREATE TRIGGER trigger_rdo_atividades_updated_at
    BEFORE UPDATE ON public.rdo_atividades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rdo_atividades_timestamp();

-- Permissões (supabase anon/key funciona com RLS)
ALTER TABLE public.rdo_atividades ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (todos podem ver)
CREATE POLICY "Allow public read rdo_atividades"
    ON public.rdo_atividades FOR SELECT
    USING (true);

-- Policy para insert (usuários autenticados)
CREATE POLICY "Allow authenticated insert rdo_atividades"
    ON public.rdo_atividades FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy para update (usuários autenticados ou próprio registro)
CREATE POLICY "Allow authenticated update rdo_atividades"
    ON public.rdo_atividades FOR UPDATE
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy para delete (usuários autenticados)
CREATE POLICY "Allow authenticated delete rdo_atividades"
    ON public.rdo_atividades FOR DELETE
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_atividades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_atividades TO anon;
