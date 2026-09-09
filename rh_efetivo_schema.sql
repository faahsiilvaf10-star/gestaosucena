-- Tabela para armazenar o efetivo (colaboradores) do RH
CREATE TABLE IF NOT EXISTS public.rh_efetivo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    cargo TEXT,
    matricula TEXT,
    data_admissao DATE,
    status TEXT DEFAULT 'Ativo',
    setor TEXT,
    raw_data JSONB, -- Armazena a linha original completa da planilha
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Habilitar RLS
ALTER TABLE public.rh_efetivo ENABLE ROW LEVEL SECURITY;

-- Política de acesso público (ajustar conforme regras de autenticação do projeto)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rh_efetivo' AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON public.rh_efetivo FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
