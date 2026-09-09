-- 1. Add location_status to existing eq_equipments table
ALTER TABLE public.eq_equipments 
ADD COLUMN IF NOT EXISTS location_status TEXT DEFAULT 'inside' CHECK (location_status IN ('inside', 'outside'));

-- 2. Create eq_movements table for tracking history
CREATE TABLE IF NOT EXISTS public.eq_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit')),
    exit_reason TEXT,
    description TEXT,
    created_by TEXT, -- Pode armazenar o nome ou email do usuário responsável
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Enable RLS on eq_movements
ALTER TABLE public.eq_movements ENABLE ROW LEVEL SECURITY;

-- 4. Create public policy for eq_movements (adjust according to your auth rules)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'eq_movements' AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON public.eq_movements FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
