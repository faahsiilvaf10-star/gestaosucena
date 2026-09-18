-- Adiciona as colunas de datas de documentação na tabela de equipamentos
ALTER TABLE public.eq_equipments
ADD COLUMN IF NOT EXISTS vistoria_ultima DATE,
ADD COLUMN IF NOT EXISTS laudo_opacidade DATE,
ADD COLUMN IF NOT EXISTS laudo_mecanico DATE,
ADD COLUMN IF NOT EXISTS plano_manutencao DATE,
ADD COLUMN IF NOT EXISTS cronografo DATE;
