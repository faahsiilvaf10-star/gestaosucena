-- Tabela de Registros de Abastecimento Caixa D'água
CREATE TABLE caixa_dagua_registros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_registro TEXT NOT NULL UNIQUE, -- Formato: YYYY-MM-Semana (ex: 2026-01-1)
    volume_litros NUMERIC NOT NULL DEFAULT 0,
    setor TEXT NOT NULL DEFAULT 'GERAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE caixa_dagua_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para todos os usuários autenticados" 
ON caixa_dagua_registros FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção/atualização para todos os usuários autenticados" 
ON caixa_dagua_registros FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para todos os usuários autenticados" 
ON caixa_dagua_registros FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir delete para todos os usuários autenticados" 
ON caixa_dagua_registros FOR DELETE 
TO authenticated 
USING (true);
