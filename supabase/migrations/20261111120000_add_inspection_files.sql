-- Migration para adicionar colunas de arquivos anexos à tabela equipment_inspections
ALTER TABLE public.equipment_inspections
ADD COLUMN IF NOT EXISTS opacity_report_file_url TEXT,
ADD COLUMN IF NOT EXISTS opacity_report_file_name TEXT,
ADD COLUMN IF NOT EXISTS mechanical_report_file_url TEXT,
ADD COLUMN IF NOT EXISTS mechanical_report_file_name TEXT,
ADD COLUMN IF NOT EXISTS maintenance_plan_file_url TEXT,
ADD COLUMN IF NOT EXISTS maintenance_plan_file_name TEXT,
ADD COLUMN IF NOT EXISTS tachograph_file_url TEXT,
ADD COLUMN IF NOT EXISTS tachograph_file_name TEXT;
