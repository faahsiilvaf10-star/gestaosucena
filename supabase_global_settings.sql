CREATE TABLE IF NOT EXISTS public.global_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON public.global_settings FOR SELECT 
USING (true);

CREATE POLICY "Enable insert/update for all users" 
ON public.global_settings FOR ALL 
USING (true) WITH CHECK (true);
