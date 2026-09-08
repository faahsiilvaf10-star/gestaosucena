-- Schema do Almoxarifado (Fase 1)

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS public.al_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS public.al_suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    trade_name TEXT,
    cnpj_cpf TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    contact_name TEXT,
    supplied_products TEXT,
    observation TEXT,
    status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela Principal de Produtos/Itens
CREATE TABLE IF NOT EXISTS public.al_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    internal_code TEXT,
    product_code TEXT,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    
    category_id UUID REFERENCES public.al_categories(id),
    subcategory TEXT,
    
    brand TEXT,
    model TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'UN',
    
    -- Controle de Estoque
    current_quantity NUMERIC DEFAULT 0 NOT NULL,
    min_stock NUMERIC DEFAULT 0 NOT NULL,
    max_stock NUMERIC,
    
    -- Localização
    location TEXT,
    warehouse TEXT,
    shelf TEXT,
    aisle TEXT,
    position TEXT,
    
    -- Compra e Fornecedor
    supplier_id UUID REFERENCES public.al_suppliers(id),
    invoice_number TEXT,
    purchase_date DATE,
    unit_value NUMERIC(10, 2),
    total_value NUMERIC(10, 2),
    
    -- Lote e Validade
    batch TEXT,
    manufacture_date DATE,
    expiration_date DATE,
    
    -- Específico para EPI
    ca_number TEXT,
    ca_expiration_date DATE,
    
    -- Específico para Ferramentas
    patrimony_number TEXT,
    
    -- Específico Químicos
    chemical_class TEXT,
    fispq_number TEXT,
    fispq_url TEXT,
    perilousness TEXT,
    
    -- Gerais
    photo_url TEXT,
    observation TEXT,
    status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permissões básicas RLS (Row Level Security)
ALTER TABLE public.al_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.al_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.al_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.al_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.al_categories FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON public.al_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.al_suppliers FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON public.al_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.al_products FOR ALL TO authenticated USING (true);

-- Inserir categorias padrões solicitadas
INSERT INTO public.al_categories (name, description) VALUES
('EPI', 'Equipamentos de Proteção Individual'),
('Ferramentas', 'Ferramentas de trabalho e manutenção'),
('Materiais', 'Materiais de construção, elétrica, hidráulica, etc.'),
('Produtos Químicos', 'Químicos, herbicidas, limpeza, óleos')
ON CONFLICT DO NOTHING;
