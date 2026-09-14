-- 1. Create table for Driver Dispatches (Daily shifts/vehicles assignments)
CREATE TABLE IF NOT EXISTS public.eq_driver_dispatch (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID NOT NULL REFERENCES public.eq_equipments(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Aguardando' CHECK (status IN ('Em atividade', 'Aguardando', 'Em deslocamento', 'Ocorrência', 'Concluído', 'Offline')),
    odometer_start NUMERIC,
    odometer_end NUMERIC,
    notes TEXT,
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
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE public.eq_driver_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_driver_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_anomalies ENABLE ROW LEVEL SECURITY;

-- Public Access Policies (Adapt to auth roles as needed, keeping open for now as requested for integration)
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
END
$$;
