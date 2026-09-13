CREATE TABLE public.seguranca_dds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    palestrante_id UUID REFERENCES public.rh_efetivo(id) ON DELETE SET NULL,
    tema TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_seguranca_dds_date UNIQUE (date)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.seguranca_dds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.seguranca_dds
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.seguranca_dds
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.seguranca_dds
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users only" ON public.seguranca_dds
    FOR DELETE USING (true);
