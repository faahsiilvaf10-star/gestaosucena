-- =========================================================================
-- ROTINA DE RESET DIÁRIO DE SESSÕES (SUPABASE PG_CRON)
-- =========================================================================
-- Desloga e invalida todas as sessões e tokens de refresh de todos os usuários
-- todo dia pontualmente às 00:00 (Horário de Brasília = 03:00 UTC).

CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 1. Função executada pelo cron com privilégios de SECURITY DEFINER
CREATE OR REPLACE FUNCTION cron_daily_logout_all_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Invalida todos os tokens de refresh e sessões ativas no schema auth
  DELETE FROM auth.refresh_tokens;
  DELETE FROM auth.sessions;
END;
$$;

-- 2. Remove agendamento anterior se já existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_session_reset_midnight') THEN
    PERFORM cron.unschedule('daily_session_reset_midnight');
  END IF;
END $$;

-- 3. Agendar todo dia às 03:00 UTC (00:00 BRT - Meia-noite de Brasília)
SELECT cron.schedule(
  'daily_session_reset_midnight',
  '0 3 * * *',
  'SELECT cron_daily_logout_all_users();'
);
