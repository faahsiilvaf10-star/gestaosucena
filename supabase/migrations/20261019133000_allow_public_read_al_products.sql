-- Migration: Permitir leitura publica (anon e authenticated) de produtos e categorias do Almoxarifado
-- Garante que mesmo sem sessao ativa ou em tablets/kiosks, o estoque de EPIs e Uniformes possa ser visualizado.

DO $$
BEGIN
    -- Politica de leitura publica para al_categories
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_categories' AND policyname = 'Enable public read access on al_categories'
    ) THEN
        CREATE POLICY "Enable public read access on al_categories" 
        ON public.al_categories FOR SELECT 
        USING (true);
    END IF;

    -- Politica de leitura publica para al_products
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_products' AND policyname = 'Enable public read access on al_products'
    ) THEN
        CREATE POLICY "Enable public read access on al_products" 
        ON public.al_products FOR SELECT 
        USING (true);
    END IF;

    -- Politica de leitura publica para al_suppliers
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_suppliers' AND policyname = 'Enable public read access on al_suppliers'
    ) THEN
        CREATE POLICY "Enable public read access on al_suppliers" 
        ON public.al_suppliers FOR SELECT 
        USING (true);
    END IF;
END
$$;
