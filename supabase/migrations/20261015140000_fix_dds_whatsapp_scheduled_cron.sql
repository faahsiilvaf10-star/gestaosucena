-- =============================================================================
-- FIX: Lembretes Automáticos do DDS (Diário de Segurança) no WhatsApp
-- =============================================================================
-- 1. Cria tabela dds_notification_log para controle idempotente de envios.
-- 2. Corrige a função de envio para resolver o nome do palestrante (name, nome, full_name).
-- 3. Garante que tanto o lembrete de Hoje (06:00) quanto o aviso prévio de Amanhã (16:00)
--    sejam enviados para o grupo do DDS configurado em global_settings.
-- 4. Adiciona timeout_milliseconds e endpoint fallback (idêntico à esteira de Lembretes).
-- 5. Configura cron contínuo de minuto em minuto ('* * * * *') para resiliência total.
-- =============================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. Tabela de histórico e idempotência dos disparos de DDS
CREATE TABLE IF NOT EXISTS public.dds_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_date DATE NOT NULL,
  target_date DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('hoje', 'amanha')),
  group_id TEXT NOT NULL,
  message TEXT NOT NULL,
  speaker_name TEXT,
  speaker_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dds_notification_log_day_type UNIQUE (notification_date, tipo)
);

CREATE INDEX IF NOT EXISTS idx_dds_notification_log_date
  ON public.dds_notification_log (notification_date DESC);

-- RLS e permissões
ALTER TABLE public.dds_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dds_notification_log_read" ON public.dds_notification_log;
CREATE POLICY "dds_notification_log_read" ON public.dds_notification_log
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Sistema pode inserir dds_notification_log" ON public.dds_notification_log;
CREATE POLICY "Sistema pode inserir dds_notification_log" ON public.dds_notification_log
  FOR INSERT WITH CHECK (true);

GRANT ALL ON public.dds_notification_log TO postgres;
GRANT ALL ON public.dds_notification_log TO service_role;
GRANT SELECT ON public.dds_notification_log TO authenticated;

-- Correção retroativa da tabela de diagnóstico caso exista
ALTER TABLE IF EXISTS public.dds_envio_log ADD COLUMN IF NOT EXISTS http_status INTEGER;
ALTER TABLE IF EXISTS public.dds_envio_log ADD COLUMN IF NOT EXISTS http_body TEXT;

-- 3. Função principal de envio executada pelo cron a cada minuto
CREATE OR REPLACE FUNCTION public.cron_send_dds_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_base_url text;
  v_endpoint text;
  v_endpoint_fallback text;
  v_target_group text;

  v_current_ts timestamptz;
  v_current_date date;
  v_current_time text;

  v_enabled_0600 boolean;
  v_enabled_1600 boolean;

  -- Variáveis de controle de envio
  v_tipo text;
  v_target_date date;
  v_dds record;
  v_speaker_name text;
  v_speaker_phone text;
  v_tema_str text;
  v_message text;
  v_payload jsonb;
  v_speaker_clean text;
BEGIN
  -- 1. Carregar configurações do WhatsApp
  SELECT value INTO v_settings FROM public.global_settings WHERE key = 'whatsapp_settings';

  IF v_settings IS NULL
     OR NULLIF(v_settings->>'url', '') IS NULL
     OR NULLIF(v_settings->>'token', '') IS NULL
     OR NULLIF(v_settings->>'instanceId', '') IS NULL THEN
    RETURN;
  END IF;

  -- 2. Grupo de destino (específico do DDS ou geral)
  v_target_group := COALESCE(
    NULLIF(v_settings->'ddsReminders'->>'specificGroupId', ''),
    NULLIF(v_settings->>'groupId', '')
  );

  IF v_target_group IS NULL OR trim(v_target_group) = '' THEN
    RETURN;
  END IF;

  -- 3. Horário atual no fuso de Brasília/Pará (UTC-3)
  v_current_ts := now() AT TIME ZONE 'America/Belem';
  v_current_date := v_current_ts::date;
  v_current_time := to_char(v_current_ts, 'HH24:MI');

  -- 4. Status de habilitação
  v_enabled_0600 := COALESCE((v_settings->'ddsReminders'->>'enabled_0600')::boolean, false);
  v_enabled_1600 := COALESCE((v_settings->'ddsReminders'->>'enabled_1600')::boolean, false);

  -- 5. Preparar endpoints W-API / Evolution (idêntico à esteira de Lembretes)
  v_base_url := trim(trailing '/' from (v_settings->>'url'));
  IF v_base_url LIKE '%painel.w-api.app%' THEN
    v_base_url := 'https://api.w-api.app/v1';
  ELSIF v_base_url LIKE '%api.w-api.app%' AND v_base_url NOT LIKE '%/v1%' THEN
    v_base_url := v_base_url || '/v1';
  END IF;

  IF v_base_url LIKE '%api.w-api.app%' THEN
    v_endpoint := v_base_url || '/messages/send-text?instanceId=' || (v_settings->>'instanceId');
    v_endpoint_fallback := v_base_url || '/message/send-text?instanceId=' || (v_settings->>'instanceId');
  ELSE
    v_endpoint := v_base_url || '/message/sendText/' || (v_settings->>'instanceId');
    v_endpoint_fallback := v_base_url || '/messages/sendText/' || (v_settings->>'instanceId');
  END IF;

  -- =========================================================================
  -- CICLO 1: Lembrete do Dia (Hoje - a partir das 06:00)
  -- =========================================================================
  IF v_enabled_0600 AND v_current_time >= '06:00' THEN
    -- Checar se já foi enviado hoje
    IF NOT EXISTS (
      SELECT 1 FROM public.dds_notification_log
      WHERE notification_date = v_current_date AND tipo = 'hoje'
    ) THEN
      v_target_date := v_current_date;

      -- Buscar o DDS do dia
      SELECT id, tema, palestrante_id
      INTO v_dds
      FROM public.seguranca_dds
      WHERE date = v_target_date
      LIMIT 1;

      IF FOUND THEN
        -- Nome do palestrante
        SELECT COALESCE(
                 raw_user_meta_data->>'name',
                 raw_user_meta_data->>'nome',
                 raw_user_meta_data->>'full_name',
                 'Não informado'
               ),
               raw_user_meta_data->>'whatsapp'
        INTO v_speaker_name, v_speaker_phone
        FROM auth.users
        WHERE id = v_dds.palestrante_id;

        IF v_speaker_name IS NULL OR trim(v_speaker_name) = '' THEN
          v_speaker_name := 'Não informado';
        END IF;

        IF v_dds.tema IS NOT NULL AND trim(v_dds.tema) != '' THEN
          v_tema_str := '*Tema:* ' || trim(v_dds.tema);
        ELSE
          v_tema_str := '*Tema:* A definir';
        END IF;

        -- Formatar mensagem
        v_message := COALESCE(
          v_settings->'messageTemplates'->>'ddsHoje',
          '🎤 *Lembrete DDS - Hoje*' || chr(10) || chr(10) ||
          '👤 *Palestrante:* {palestrante}' || chr(10) ||
          '📅 *Data:* {data} (hoje)' || chr(10) ||
          '📋 {tema}' || chr(10) || chr(10) ||
          '_Mensagem automática - Sucena_'
        );

        v_message := replace(v_message, '{palestrante}', v_speaker_name);
        v_message := replace(v_message, '{data}', to_char(v_target_date, 'DD/MM/YYYY'));
        v_message := replace(v_message, '{tema}', v_tema_str);

        -- Enviar para o grupo
        v_payload := jsonb_build_object(
          'number', v_target_group,
          'phone',  v_target_group,
          'text',   v_message,
          'message', v_message
        );

        PERFORM net.http_post(
          url := v_endpoint,
          body := v_payload,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer' || ' ' || (v_settings->>'token'),
            'apikey', (v_settings->>'token')
          ),
          timeout_milliseconds := 10000
        );

        PERFORM net.http_post(
          url := v_endpoint_fallback,
          body := v_payload,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer' || ' ' || (v_settings->>'token'),
            'apikey', (v_settings->>'token')
          ),
          timeout_milliseconds := 10000
        );

        -- Registrar envio idempotente
        INSERT INTO public.dds_notification_log (
          notification_date, target_date, tipo, group_id, message, speaker_name, speaker_phone
        ) VALUES (
          v_current_date, v_target_date, 'hoje', v_target_group, v_message, v_speaker_name, v_speaker_phone
        ) ON CONFLICT (notification_date, tipo) DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- =========================================================================
  -- CICLO 2: Aviso Prévio (Amanhã - a partir das 16:00)
  -- =========================================================================
  IF v_enabled_1600 AND v_current_time >= '16:00' THEN
    -- Checar se já foi enviado hoje
    IF NOT EXISTS (
      SELECT 1 FROM public.dds_notification_log
      WHERE notification_date = v_current_date AND tipo = 'amanha'
    ) THEN
      v_target_date := v_current_date + 1;

      -- Buscar o DDS do dia seguinte
      SELECT id, tema, palestrante_id
      INTO v_dds
      FROM public.seguranca_dds
      WHERE date = v_target_date
      LIMIT 1;

      IF FOUND THEN
        -- Nome do palestrante
        SELECT COALESCE(
                 raw_user_meta_data->>'name',
                 raw_user_meta_data->>'nome',
                 raw_user_meta_data->>'full_name',
                 'Não informado'
               ),
               raw_user_meta_data->>'whatsapp'
        INTO v_speaker_name, v_speaker_phone
        FROM auth.users
        WHERE id = v_dds.palestrante_id;

        IF v_speaker_name IS NULL OR trim(v_speaker_name) = '' THEN
          v_speaker_name := 'Não informado';
        END IF;

        IF v_dds.tema IS NOT NULL AND trim(v_dds.tema) != '' THEN
          v_tema_str := '*Tema:* ' || trim(v_dds.tema);
        ELSE
          v_tema_str := '*Tema:* A definir';
        END IF;

        -- Formatar mensagem
        v_message := COALESCE(
          v_settings->'messageTemplates'->>'ddsAmanha',
          '🎤 *Aviso Prévio DDS - Amanhã*' || chr(10) || chr(10) ||
          '👤 *Palestrante:* {palestrante}' || chr(10) ||
          '📅 *Data:* {data} (amanhã)' || chr(10) ||
          '📋 {tema}' || chr(10) || chr(10) ||
          '_Mensagem automática - Sucena_'
        );

        v_message := replace(v_message, '{palestrante}', v_speaker_name);
        v_message := replace(v_message, '{data}', to_char(v_target_date, 'DD/MM/YYYY'));
        v_message := replace(v_message, '{tema}', v_tema_str);

        -- Enviar para o grupo
        v_payload := jsonb_build_object(
          'number', v_target_group,
          'phone',  v_target_group,
          'text',   v_message,
          'message', v_message
        );

        PERFORM net.http_post(
          url := v_endpoint,
          body := v_payload,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer' || ' ' || (v_settings->>'token'),
            'apikey', (v_settings->>'token')
          ),
          timeout_milliseconds := 10000
        );

        PERFORM net.http_post(
          url := v_endpoint_fallback,
          body := v_payload,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer' || ' ' || (v_settings->>'token'),
            'apikey', (v_settings->>'token')
          ),
          timeout_milliseconds := 10000
        );

        -- Envio adicional ao palestrante no privado se houver WhatsApp
        IF v_speaker_phone IS NOT NULL AND trim(v_speaker_phone) != '' THEN
          v_speaker_clean := regexp_replace(v_speaker_phone, '\D', '', 'g');
          IF length(v_speaker_clean) >= 10 THEN
            IF v_speaker_clean NOT LIKE '55%' THEN
              v_speaker_clean := '55' || v_speaker_clean;
            END IF;

            PERFORM net.http_post(
              url := v_endpoint,
              body := jsonb_build_object(
                'number', v_speaker_clean,
                'phone',  v_speaker_clean,
                'text',   v_message,
                'message', v_message
              ),
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer' || ' ' || (v_settings->>'token'),
                'apikey', (v_settings->>'token')
              ),
              timeout_milliseconds := 10000
            );
          END IF;
        END IF;

        -- Registrar envio idempotente
        INSERT INTO public.dds_notification_log (
          notification_date, target_date, tipo, group_id, message, speaker_name, speaker_phone
        ) VALUES (
          v_current_date, v_target_date, 'amanha', v_target_group, v_message, v_speaker_name, v_speaker_phone
        ) ON CONFLICT (notification_date, tipo) DO NOTHING;
      END IF;
    END IF;
  END IF;

END;
$$;

-- 4. Função legada mantida para retrocompatibilidade
CREATE OR REPLACE FUNCTION public.cron_send_dds_reminder(is_today boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cron_send_dds_reminders();
END;
$$;

-- 5. Garantir grants de execução
GRANT EXECUTE ON FUNCTION public.cron_send_dds_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.cron_send_dds_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_send_dds_reminders() TO service_role;

GRANT EXECUTE ON FUNCTION public.cron_send_dds_reminder(boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.cron_send_dds_reminder(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_send_dds_reminder(boolean) TO service_role;

-- 6. Configurar Agendamento Minutely no pg_cron (idêntico ao reminders_minutely)
DO $$
BEGIN
  PERFORM cron.unschedule('dds_lembrete_0600');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('dds_aviso_1600');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('dds_reminders_minutely');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dds_reminders_minutely',
  '* * * * *',
  $$ SELECT public.cron_send_dds_reminders(); $$
);
