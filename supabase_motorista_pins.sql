CREATE TABLE IF NOT EXISTS public.app_motorista_pins (
  driver_id text primary key,
  pin text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
ALTER TABLE public.app_motorista_pins ENABLE ROW LEVEL SECURITY;

-- Allow anyone (even non-logged in users) to read the PINs to verify login
CREATE POLICY "Allow public read" ON public.app_motorista_pins 
FOR SELECT USING (true);

-- Allow anyone to insert a PIN (only works once per driver_id because it's a Primary Key)
CREATE POLICY "Allow public insert" ON public.app_motorista_pins 
FOR INSERT WITH CHECK (true);
