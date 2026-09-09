-- Create eq_equipments table
CREATE TABLE IF NOT EXISTS public.eq_equipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    plate_tag TEXT NOT NULL UNIQUE,
    type TEXT,
    category TEXT DEFAULT 'Equipamento Pesado',
    status TEXT DEFAULT 'Sem status',
    location_status TEXT DEFAULT 'inside',
    last_exit_reason TEXT,
    last_exit_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Insert initial data (Idempotent using ON CONFLICT)
INSERT INTO public.eq_equipments (name, plate_tag, type, status)
VALUES
    ('PIPA 01', 'SKK6I64', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 02', 'RQN2D45', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 03', 'RQS3F79', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 04', 'SKR6B90', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 05', 'RQR7I03', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 06', 'SKQ7H63', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 07', 'SKQ0B03', 'Caminhão Pipa', 'Sem status'),
    ('PIPA 08', 'SKQ2D75', 'Caminhão Pipa', 'Sem status')
ON CONFLICT (plate_tag) DO NOTHING;

-- Enable RLS and create a public policy so the app can access it
ALTER TABLE public.eq_equipments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'eq_equipments' AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON public.eq_equipments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
