-- 1. Create table for tracking daily attendance records
CREATE TABLE IF NOT EXISTS public.rh_presencas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    area TEXT NOT NULL,
    funcionario_id UUID NOT NULL REFERENCES public.rh_efetivo(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PRESENTE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(data, funcionario_id) -- Only one attendance record per employee per day
);

-- 2. Enable RLS
ALTER TABLE public.rh_presencas ENABLE ROW LEVEL SECURITY;

-- 3. Create public policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rh_presencas' AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON public.rh_presencas FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
