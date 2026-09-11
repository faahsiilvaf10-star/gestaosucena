-- Sequence para numeração global e atômica dos pedidos de compra
CREATE SEQUENCE IF NOT EXISTS al_purchase_order_number_seq START 1;

-- Tabela Principal de Pedidos de Compra
CREATE TABLE IF NOT EXISTS public.al_purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number INTEGER UNIQUE, -- Preenchido automaticamente via trigger se não for rascunho
    requester_user_id UUID NOT NULL, -- O solicitante logado (referência ideal para auth.users, mas deixamos aberto UUID caso auth não esteja no public)
    responsible_id UUID REFERENCES public.rh_efetivo(id),
    expected_delivery_date DATE NOT NULL,
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgente', 'Crítico')),
    status TEXT DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Solicitado', 'Em Compra', 'Comprado', 'Recebimento Parcial', 'Recebido', 'Cancelado')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Itens do Pedido de Compra
CREATE TABLE IF NOT EXISTS public.al_purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES public.al_purchase_orders(id) ON DELETE CASCADE NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    quantity_received NUMERIC DEFAULT 0 CHECK (quantity_received >= 0),
    unit TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger Function para assinalar o número do pedido automaticamente
CREATE OR REPLACE FUNCTION assign_purchase_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status não for Rascunho e ainda não tiver um número, assinala um novo número
    IF NEW.status != 'Rascunho' AND NEW.order_number IS NULL THEN
        NEW.order_number := nextval('al_purchase_order_number_seq');
    END IF;
    
    -- Atualiza o updated_at em qualquer alteração
    NEW.updated_at := timezone('utc'::text, now());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para tabela de pedidos
DROP TRIGGER IF EXISTS trigger_assign_purchase_order_number ON public.al_purchase_orders;
CREATE TRIGGER trigger_assign_purchase_order_number
BEFORE INSERT OR UPDATE ON public.al_purchase_orders
FOR EACH ROW EXECUTE FUNCTION assign_purchase_order_number();

-- Trigger Function para atualizar updated_at nos itens
CREATE OR REPLACE FUNCTION update_al_purchase_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para itens
DROP TRIGGER IF EXISTS trigger_update_al_purchase_order_items_updated_at ON public.al_purchase_order_items;
CREATE TRIGGER trigger_update_al_purchase_order_items_updated_at
BEFORE UPDATE ON public.al_purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_al_purchase_order_items_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.al_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.al_purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para o schema (em produção, refinar de acordo com papéis)
DO $$
BEGIN
    -- al_purchase_orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_purchase_orders' AND policyname = 'Enable all access for authenticated users on al_purchase_orders'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on al_purchase_orders" ON public.al_purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- al_purchase_order_items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'al_purchase_order_items' AND policyname = 'Enable all access for authenticated users on al_purchase_order_items'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on al_purchase_order_items" ON public.al_purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;
