-- Add category column to eq_equipments table
ALTER TABLE public.eq_equipments
ADD COLUMN category TEXT DEFAULT 'Equipamento Pesado';
