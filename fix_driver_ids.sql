-- Remover chaves estrangeiras de driver_id vinculadas ao auth.users
ALTER TABLE public.eq_driver_dispatch DROP CONSTRAINT IF EXISTS eq_driver_dispatch_driver_id_fkey;
ALTER TABLE public.eq_checklists DROP CONSTRAINT IF EXISTS eq_checklists_driver_id_fkey;
ALTER TABLE public.eq_fuel_records DROP CONSTRAINT IF EXISTS eq_fuel_records_driver_id_fkey;
ALTER TABLE public.eq_status_history DROP CONSTRAINT IF EXISTS eq_status_history_driver_id_fkey;

-- Mudar o tipo da coluna para TEXT para aceitar os IDs do App (ex: 'EM', 'ED')
ALTER TABLE public.eq_driver_dispatch ALTER COLUMN driver_id TYPE TEXT USING driver_id::text;
ALTER TABLE public.eq_checklists ALTER COLUMN driver_id TYPE TEXT USING driver_id::text;
ALTER TABLE public.eq_fuel_records ALTER COLUMN driver_id TYPE TEXT USING driver_id::text;
ALTER TABLE public.eq_status_history ALTER COLUMN driver_id TYPE TEXT USING driver_id::text;
