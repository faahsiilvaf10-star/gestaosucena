CREATE TABLE IF NOT EXISTS pluviometria_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_registro DATE NOT NULL UNIQUE,
  volume_mm NUMERIC NOT NULL DEFAULT 0,
  setor TEXT DEFAULT 'CAMPO',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE pluviometria_registros ENABLE ROW LEVEL SECURITY;

-- Políticas (Permitir leitura/escrita para todos os usuários autenticados por enquanto)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for all authenticated users' AND tablename = 'pluviometria_registros'
    ) THEN
        CREATE POLICY "Enable read access for all authenticated users" ON pluviometria_registros
            FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert access for all authenticated users' AND tablename = 'pluviometria_registros'
    ) THEN
        CREATE POLICY "Enable insert access for all authenticated users" ON pluviometria_registros
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Enable update access for all authenticated users' AND tablename = 'pluviometria_registros'
    ) THEN
        CREATE POLICY "Enable update access for all authenticated users" ON pluviometria_registros
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;
