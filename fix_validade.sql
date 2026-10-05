-- Script para corrigir a coluna de validade ASO para usar o campo correto (aso_admissional_2)
-- Copie e cole este script no painel SQL Editor do seu Supabase para executar

ALTER TABLE public.rh_efetivo DROP COLUMN IF EXISTS validade_aso_efetiva;

ALTER TABLE public.rh_efetivo
ADD COLUMN validade_aso_efetiva DATE GENERATED ALWAYS AS (
    GREATEST(aso_admissional, aso_periodico, retorno_ao_trabalho, mudanca_de_risco) + integer '365'
) STORED;
