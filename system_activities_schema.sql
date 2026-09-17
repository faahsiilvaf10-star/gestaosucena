-- Create system_activities table
CREATE TABLE IF NOT EXISTS public.system_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    user_name TEXT
);

-- Enable RLS
ALTER TABLE public.system_activities ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to insert
CREATE POLICY "Allow authenticated users to insert system activities" 
ON public.system_activities 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Create policy to allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read system activities" 
ON public.system_activities 
FOR SELECT 
TO authenticated 
USING (true);

-- Also allow anonymous insert/select for now if auth is not fully enforced on all routes
CREATE POLICY "Allow anon insert system activities" 
ON public.system_activities 
FOR INSERT 
TO anon 
WITH CHECK (true);

CREATE POLICY "Allow anon select system activities" 
ON public.system_activities 
FOR SELECT 
TO anon 
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_activities;
