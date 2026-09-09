-- 1. Create equipment_inspections table for tracking expiry dates
CREATE TABLE IF NOT EXISTS public.equipment_inspections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID NOT NULL UNIQUE REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    opacity_report_expiry DATE,
    mechanical_report_expiry DATE,
    maintenance_plan_expiry DATE,
    tachograph_expiry DATE,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Enable RLS on equipment_inspections
ALTER TABLE public.equipment_inspections ENABLE ROW LEVEL SECURITY;

-- 3. Create public policy for equipment_inspections (adjust according to your auth rules)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'equipment_inspections' AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON public.equipment_inspections FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
