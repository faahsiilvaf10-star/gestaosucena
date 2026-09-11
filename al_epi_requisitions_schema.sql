-- Schema para Requisições de EPI

CREATE TABLE IF NOT EXISTS public.al_epi_requisitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
    authorizer_id UUID REFERENCES public.rh_efetivo(id) NOT NULL,
    employee_id UUID REFERENCES public.rh_efetivo(id) NOT NULL,
    reason TEXT,
    destination_area TEXT,
    status TEXT DEFAULT 'Concluído' CHECK (status IN ('Rascunho', 'Concluído', 'Cancelado')),
    receipt_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.al_epi_requisition_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requisition_id UUID REFERENCES public.al_epi_requisitions(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.al_products(id) NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger Function para abater o estoque automaticamente e atualizar a data do produto
CREATE OR REPLACE FUNCTION process_epi_requisition_item()
RETURNS TRIGGER AS $$
BEGIN
    -- Subtrair quantidade do estoque
    UPDATE public.al_products
    SET current_quantity = current_quantity - NEW.quantity,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_process_epi_requisition_item ON public.al_epi_requisition_items;
CREATE TRIGGER trigger_process_epi_requisition_item
AFTER INSERT ON public.al_epi_requisition_items
FOR EACH ROW EXECUTE FUNCTION process_epi_requisition_item();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.al_epi_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.al_epi_requisition_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_epi_requisitions' AND policyname = 'Enable all access for authenticated users on al_epi_requisitions'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on al_epi_requisitions" ON public.al_epi_requisitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_epi_requisition_items' AND policyname = 'Enable all access for authenticated users on al_epi_requisition_items'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on al_epi_requisition_items" ON public.al_epi_requisition_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;
