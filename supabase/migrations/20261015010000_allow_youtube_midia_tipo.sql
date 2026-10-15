-- ============================================================
--  CORREÇÃO: aceita vídeos do YouTube em comunicado_midias
--
--  A migration 20261015000000 usa CREATE TABLE IF NOT EXISTS.
--  Se a tabela já existia, o CHECK antigo (video/foto/audio) continua
--  valendo e o INSERT com tipo 'youtube' falha.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ============================================================

ALTER TABLE public.comunicado_midias
  DROP CONSTRAINT IF EXISTS comunicado_midias_tipo_check;

ALTER TABLE public.comunicado_midias
  ADD CONSTRAINT comunicado_midias_tipo_check
  CHECK (tipo IN ('video', 'foto', 'audio', 'youtube'));

-- Confirmação: deve retornar a constraint com 'youtube' incluído
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conname = 'comunicado_midias_tipo_check';
