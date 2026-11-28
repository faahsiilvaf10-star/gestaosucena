-- Migração: Suporte a Mobilização e Desmobilização de Equipamentos
-- Adiciona colunas mobilized_at e demobilized_at na tabela eq_equipments se não existirem

ALTER TABLE public.eq_equipments
ADD COLUMN IF NOT EXISTS mobilized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS demobilized_at TIMESTAMPTZ;

-- Comentários das colunas para documentação do schema
COMMENT ON COLUMN public.eq_equipments.mobilized_at IS 'Data e hora em que o equipamento foi mobilizado na obra';
COMMENT ON COLUMN public.eq_equipments.demobilized_at IS 'Data e hora em que o equipamento foi desmobilizado da obra';
