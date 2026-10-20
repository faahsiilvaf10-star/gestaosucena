-- Migration: Adicionar coluna itens jsonb na tabela rdo_atividades para suporte a sub-atividades / checklists customizados

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rdo_atividades' 
        AND column_name = 'itens'
    ) THEN
        ALTER TABLE public.rdo_atividades ADD COLUMN itens JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
