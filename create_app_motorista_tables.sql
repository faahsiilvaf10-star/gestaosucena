-- 1. Create table for Driver Dispatches (Daily shifts/vehicles assignments)
CREATE TABLE IF NOT EXISTS public.eq_driver_dispatch (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Aguardando' CHECK (status IN ('Em atividade', 'Aguardando', 'Em deslocamento', 'Ocorrência', 'Concluído', 'Offline')),
    odometer_start NUMERIC,
    odometer_end NUMERIC,
    notes TEXT,
    environment_id TEXT,
    helper_name TEXT,
    horimeter_start NUMERIC,
    horimeter_end NUMERIC,
    fuel_start_percent INTEGER,
    fuel_end_percent INTEGER,
    shift_start_time TIMESTAMP WITH TIME ZONE,
    shift_end_time TIMESTAMP WITH TIME ZONE,
    app_sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Ensure a driver/equipment combination is unique per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_dispatch_unique ON public.eq_driver_dispatch(equipment_id, driver_id, dispatch_date);

-- 2. Create table for activities/points in the timeline
CREATE TABLE IF NOT EXISTS public.eq_driver_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    activity_name TEXT NOT NULL,
    expected_time TIME,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em deslocamento', 'No local', 'Em execução', 'Pausa', 'Concluído', 'Cancelado', 'Atrasado')),
    observation TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Create table for Anomalies
CREATE TABLE IF NOT EXISTS public.eq_anomalies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    location_name TEXT,
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('Problema mecânico', 'Pneu', 'Problema elétrico', 'Combustível', 'Acidente/incidente', 'Atraso', 'Via bloqueada', 'Falha operacional', 'Outro')),
    description TEXT NOT NULL,
    photo_url TEXT,
    observation TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em análise', 'Resolvido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Tabela de Checklists Diários
CREATE TABLE IF NOT EXISTS public.eq_checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pre-operacional', 'pos-operacional')),
    status TEXT NOT NULL CHECK (status IN ('aprovado', 'reprovado', 'aprovado_com_ressalvas')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    signature_url TEXT,
    app_sync_status TEXT DEFAULT 'synced'
);

-- 5. Itens do Checklist
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

-- 6. Tabela de Abastecimentos (Fuel Records)
CREATE TABLE IF NOT EXISTS public.eq_fuel_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
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

-- 7. Tabela de Abastecimento de Água (Pipa)
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

-- 8. Histórico da Linha do Tempo (Timeline / Status history)
CREATE TABLE IF NOT EXISTS public.eq_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID REFERENCES public.eq_driver_dispatch(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    app_sync_status TEXT DEFAULT 'synced'
);

-- Enable RLS
ALTER TABLE public.eq_driver_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_driver_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_water_refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_status_history ENABLE ROW LEVEL SECURITY;

-- Public Access Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_driver_dispatch' AND policyname = 'Enable all access eq_driver_dispatch') THEN
        CREATE POLICY "Enable all access eq_driver_dispatch" ON public.eq_driver_dispatch FOR ALL USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_driver_activities' AND policyname = 'Enable all access eq_driver_activities') THEN
        CREATE POLICY "Enable all access eq_driver_activities" ON public.eq_driver_activities FOR ALL USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_anomalies' AND policyname = 'Enable all access eq_anomalies') THEN
        CREATE POLICY "Enable all access eq_anomalies" ON public.eq_anomalies FOR ALL USING (true) WITH CHECK (true);
    END IF;

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
