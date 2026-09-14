-- Schema Complementar: App Motorista
-- Integra-se com eq_equipments, auth.users e eq_driver_dispatch (Jornadas)

-- 1. Modificar eq_driver_dispatch para comportar mais dados do turno
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS environment_id TEXT;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS helper_name TEXT;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS horimeter_start NUMERIC;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS horimeter_end NUMERIC;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS fuel_start_percent INTEGER;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS fuel_end_percent INTEGER;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS shift_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS shift_end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.eq_driver_dispatch ADD COLUMN IF NOT EXISTS app_sync_status TEXT DEFAULT 'synced';

-- 2. Tabela de Checklists Diários
CREATE TABLE IF NOT EXISTS public.eq_checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES auth.users(id),
    type TEXT NOT NULL CHECK (type IN ('pre-operacional', 'pos-operacional')),
    status TEXT NOT NULL CHECK (status IN ('aprovado', 'reprovado', 'aprovado_com_ressalvas')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    signature_url TEXT,
    app_sync_status TEXT DEFAULT 'synced'
);

-- 3. Itens do Checklist
CREATE TABLE IF NOT EXISTS public.eq_checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    checklist_id UUID NOT NULL REFERENCES public.eq_checklists(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    is_critical BOOLEAN DEFAULT false,
    status TEXT NOT NULL CHECK (status IN ('conforme', 'nao_conforme', 'nao_se_aplica')),
    observation TEXT,
    photo_url TEXT,
    severity TEXT CHECK (severity IN ('baixo', 'medio', 'alto', 'critico'))
);

-- 4. Tabela de Abastecimentos (Fuel Records)
CREATE TABLE IF NOT EXISTS public.eq_fuel_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES auth.users(id),
    fuel_type TEXT NOT NULL,
    quantity_liters NUMERIC NOT NULL,
    fuel_before_percent INTEGER,
    fuel_after_percent INTEGER,
    odometer NUMERIC,
    horimeter NUMERIC,
    location_name TEXT,
    requisition_number TEXT,
    observation TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    app_sync_status TEXT DEFAULT 'synced'
);

-- 5. Tabela de Abastecimento de Água (Pipa)
CREATE TABLE IF NOT EXISTS public.eq_water_refills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    estimated_volume NUMERIC,
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Histórico da Linha do Tempo (Timeline / Status history)
CREATE TABLE IF NOT EXISTS public.eq_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES auth.users(id),
    previous_status TEXT,
    new_status TEXT NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    app_sync_status TEXT DEFAULT 'synced'
);

-- Enable RLS (Public for internal company usage according to previous setups)
ALTER TABLE public.eq_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_water_refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_checklists' AND policyname = 'Enable all access eq_checklists') THEN
        CREATE POLICY "Enable all access eq_checklists" ON public.eq_checklists FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_checklist_items' AND policyname = 'Enable all access eq_checklist_items') THEN
        CREATE POLICY "Enable all access eq_checklist_items" ON public.eq_checklist_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_fuel_records' AND policyname = 'Enable all access eq_fuel_records') THEN
        CREATE POLICY "Enable all access eq_fuel_records" ON public.eq_fuel_records FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_water_refills' AND policyname = 'Enable all access eq_water_refills') THEN
        CREATE POLICY "Enable all access eq_water_refills" ON public.eq_water_refills FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_status_history' AND policyname = 'Enable all access eq_status_history') THEN
        CREATE POLICY "Enable all access eq_status_history" ON public.eq_status_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
