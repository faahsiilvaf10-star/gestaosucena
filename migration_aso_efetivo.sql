-- Script para adicionar os campos de ASO na tabela Efetivo
-- Copie e cole este script no painel SQL Editor do seu Supabase para executar

ALTER TABLE public.rh_efetivo
ADD COLUMN IF NOT EXISTS aso_admissional DATE,
ADD COLUMN IF NOT EXISTS aso_periodico DATE,
ADD COLUMN IF NOT EXISTS retorno_ao_trabalho DATE,
ADD COLUMN IF NOT EXISTS mudanca_de_risco DATE,
ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Criação da coluna gerada automaticamente para a Validade Efetiva
ALTER TABLE public.rh_efetivo
ADD COLUMN IF NOT EXISTS validade_aso_efetiva DATE GENERATED ALWAYS AS (
    GREATEST(aso_admissional, aso_periodico, retorno_ao_trabalho, mudanca_de_risco) + integer '365'
) STORED;

-- Migração de dados: Transferir as datas de admissão já existentes para a nova coluna "aso_admissional"
UPDATE public.rh_efetivo 
SET aso_admissional = data_admissao 
WHERE aso_admissional IS NULL AND data_admissao IS NOT NULL;
