CREATE TABLE IF NOT EXISTS public.meeting_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL,
    started_by UUID REFERENCES auth.users(id),
    started_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meeting_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to insert meeting_history"
    ON public.meeting_history FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select meeting_history"
    ON public.meeting_history FOR SELECT TO authenticated
    USING (true);
