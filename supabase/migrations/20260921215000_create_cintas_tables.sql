CREATE TABLE public.seguranca_cintas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tag text NOT NULL,
  descricao text NOT NULL,
  cor text NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  inspecionada_em text,
  foto text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.seguranca_cintas_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cinta_id uuid REFERENCES public.seguranca_cintas(id) ON DELETE CASCADE,
  tag text NOT NULL,
  descricao text NOT NULL,
  cor text NOT NULL,
  data text NOT NULL,
  status text NOT NULL,
  inspetor text NOT NULL,
  observacoes text,
  foto text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.seguranca_cintas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguranca_cintas_historico ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Permitir leitura para todos os usuários autenticados" ON public.seguranca_cintas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir leitura do historico para todos os usuários autenticados" ON public.seguranca_cintas_historico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir edição para todos os usuários autenticados" ON public.seguranca_cintas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir edição do historico para todos os usuários autenticados" ON public.seguranca_cintas_historico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dados Iniciais
INSERT INTO public.seguranca_cintas (id, tag, descricao, cor, status, inspecionada_em) VALUES
  ('00000000-0000-0000-0000-000000000001', 'E-SUC-001', 'CINTA 4T - 4M', 'Vermelho', 'Pendente', NULL),
  ('00000000-0000-0000-0000-000000000002', 'E-SUC-002', 'CINTA 4T - 4M', 'Vermelho', 'Pendente', NULL),
  ('00000000-0000-0000-0000-000000000003', 'E-SUC-003', 'CINTA 4T - 4M', 'Azul', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000004', 'E-SUC-004', 'CINTA 4T - 4M', 'Azul', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000005', 'E-SUC-005', 'CINTA 4T - 4M', 'Amarelo', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000006', 'E-SUC-006', 'CINTA 4T - 4M', 'Amarelo', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000008', 'E-SUC-008', 'CINTA 6T - 4M', 'Verde', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000009', 'E-SUC-009', 'CINTA 6T - 4M', 'Verde', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000010', 'E-SUC-010', 'CINTA 2T - 2M', 'Vermelho', 'Pendente', NULL),
  ('00000000-0000-0000-0000-000000000011', 'E-SUC-011', 'CINTA 2T - 2M', 'Vermelho', 'Pendente', NULL),
  ('00000000-0000-0000-0000-000000000012', 'E-SUC-012', 'CINTA 2T - 2M', 'Azul', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000013', 'E-SUC-013', 'CINTA 2T - 2M', 'Azul', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000014', 'E-SUC-014', 'CINTA 2T - 6M', 'Amarelo', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000015', 'E-SUC-015', 'CINTA 2T - 6M', 'Amarelo', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000016', 'E-SUC-016', 'CINTA 2T - 6M', 'Verde', 'Não é mês de inspeção', NULL),
  ('00000000-0000-0000-0000-000000000017', 'E-SUC-017', 'CINTA 2T - 6M', 'Verde', 'Não é mês de inspeção', NULL)
ON CONFLICT (id) DO NOTHING;
