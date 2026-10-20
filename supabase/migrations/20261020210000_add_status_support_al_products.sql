-- Migration: Garantir coluna status para suporte a exclusão/inativação no almoxarifado (al_products)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'al_products' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.al_products ADD COLUMN status TEXT DEFAULT 'Ativo';
    END IF;
END $$;
