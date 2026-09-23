-- =============================================================================
-- FIX: Lembretes WhatsApp - Correcao completa do cron e RLS
-- =============================================================================
-- PROBLEMA 1: A politica de INSERT em reminder_notifications exige TO authenticated
--             mas o pg_cron roda como postgres (nao autenticado). Isso impede que
--             a notificacao in-app seja inserida e que o realtime dispare.
-- PROBLEMA 2: O endpoint W-API no cron usa /message/send-text (singular) mas a
--             API real usa /messages/send-text (plural).
-- =============================================================================

-- 1. Corrigir a politica de INSERT para permitir que o cron insira notificacoes
DROP POLICY IF EXISTS "Sistema pode inserir notificacoes" ON public.reminder_notifications;

CREATE POLICY "Sistema pode inserir notificacoes" 
  ON public.reminder_notifications 
  FOR INSERT 
  WITH CHECK (true);

-- Garantir grants diretos
GRANT INSERT ON public.reminder_notifications TO service_role;
GRANT INSERT ON public.reminder_notifications TO postgres;
GRANT SELECT ON public.reminder_notifications TO postgres;
GRANT UPDATE ON public.reminders TO postgres;
GRANT SELECT ON public.reminders TO postgres;
GRANT SELECT ON public.reminder_mentions TO postgres;

-- 2. Garantir que reminder_notifications esta no realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reminder_notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 3. Recriar a funcao com correcoes de endpoint e permissoes
CREATE OR REPLACE FUNCTION cron_send_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_reminders_enabled boolean;
  v_base_url text;
  v_endpoint text;
  v_endpoint_fallback text;
  
  v_current_ts timestamptz;
  v_current_date date;
  v_current_time text;
  v_current_dow integer;
  
  r record;
  m record;
  v_payload jsonb;
  v_message text;
  v_phones text[];
  v_phone text;
  v_is_advance boolean;
  v_advance_days integer;
BEGIN
  -- Carregar configuracoes
  SELECT value INTO v_settings FROM global_settings WHERE key = 'whatsapp_settings';
  
  IF v_settings IS NULL OR v_settings->>'url' IS NULL OR v_settings->>'token' IS NULL THEN
    RETURN;
  END IF;

  v_reminders_enabled := (v_settings->'reminders'->>'enabled')::boolean;

  IF v_reminders_enabled IS NULL OR NOT v_reminders_enabled THEN
    RETURN;
  END IF;

  -- Horarios atuais (America/Belem = UTC-3)
  v_current_ts := now() AT TIME ZONE 'America/Belem';
  v_current_date := v_current_ts::date;
  v_current_time := to_char(v_current_ts, 'HH24:MI');
  v_current_dow := EXTRACT(DOW FROM v_current_ts);

  -- Preparar endpoint
  v_base_url := trim(trailing '/' from (v_settings->>'url'));
  
  IF v_base_url LIKE '%painel.w-api.app%' THEN
    v_base_url := 'https://api.w-api.app/v1';
  ELSIF v_base_url LIKE '%api.w-api.app%' AND v_base_url NOT LIKE '%/v1%' THEN
    v_base_url := v_base_url || '/v1';
  END IF;

  IF v_base_url LIKE '%api.w-api.app%' THEN
    -- Endpoint principal (plural - correto para W-API)
    v_endpoint := v_base_url || '/messages/send-text?instanceId=' || (v_settings->>'instanceId');
    -- Fallback (singular)
    v_endpoint_fallback := v_base_url || '/message/send-text?instanceId=' || (v_settings->>'instanceId');
  ELSE
    -- Evolution API padrao
    v_endpoint := v_base_url || '/message/sendText/' || (v_settings->>'instanceId');
    v_endpoint_fallback := v_base_url || '/messages/sendText/' || (v_settings->>'instanceId');
  END IF;

  -- Percorrer todos os lembretes pendentes ou em andamento
  FOR r IN 
    SELECT * FROM reminders 
    WHERE status IN ('Pendente', 'Em andamento')
  LOOP
    v_is_advance := false;
    v_advance_days := COALESCE((r.recurrence_config->>'advanceNotice')::integer, 0);

    DECLARE
      v_trigger_now boolean := false;
      v_is_target_day boolean := false;
      v_is_advance_day boolean := false;
    BEGIN
      v_phones := '{}';

      -- Verificar dia do lembrete
      IF r.is_recurring THEN
        IF r.recurrence_config->'days' @> to_jsonb(v_current_dow) THEN
          v_is_target_day := true;
        END IF;
      ELSE
        IF r.due_date IS NOT NULL AND r.due_date::date <= v_current_date THEN
          v_is_target_day := true;
        END IF;
      END IF;

      -- Verificar aviso antecipado
      IF v_advance_days > 0 THEN
        IF r.is_recurring THEN
          IF r.recurrence_config->'days' @> to_jsonb((v_current_dow + v_advance_days) % 7) THEN
            v_is_advance_day := true;
          END IF;
        ELSE
          IF r.due_date IS NOT NULL AND (r.due_date::date - v_advance_days) = v_current_date THEN
            v_is_advance_day := true;
          END IF;
        END IF;
      END IF;

      -- Verificar horario
      IF v_is_target_day THEN
        IF r.due_time IS NOT NULL THEN
          IF to_char(r.due_time, 'HH24:MI') <= v_current_time THEN
            v_trigger_now := true;
            v_is_advance := false;
          END IF;
        ELSE
          IF v_current_time >= '06:00' THEN
            v_trigger_now := true;
            v_is_advance := false;
          END IF;
        END IF;
      END IF;

      IF v_is_advance_day AND NOT v_trigger_now THEN
        IF v_current_time >= '16:00' THEN
          v_trigger_now := true;
          v_is_advance := true;
        END IF;
      END IF;

      IF NOT v_trigger_now THEN
        CONTINUE;
      END IF;

      -- Evitar reenvio no mesmo dia
      IF r.last_notified_at IS NOT NULL 
         AND (r.last_notified_at AT TIME ZONE 'America/Belem')::date = v_current_date THEN
        CONTINUE;
      END IF;

      -- Montar mensagem
      IF v_is_advance THEN
        v_message := COALESCE(
          v_settings->'messageTemplates'->>'lembreteAmanha',
          E'\u23F3 *Aviso Antecipado de Lembrete*\n\n\uD83D\uDCCC *{titulo}*\n_{descricao}_\n\n\uD83D\uDCC5 Data: {data}\n\u23F0 Horario: {hora}'
        );
      ELSE
        v_message := COALESCE(
          v_settings->'messageTemplates'->>'lembreteHoje',
          E'\uD83D\uDD14 *Lembrete Automatico*\n\n\uD83D\uDCCC *{titulo}*\n_{descricao}_\n\n\uD83D\uDCC5 Data: {data}\n\u23F0 Horario: {hora}'
        );
      END IF;

      v_message := replace(v_message, '{titulo}', COALESCE(r.title, ''));
      v_message := replace(v_message, '{descricao}', COALESCE(r.description, ''));
      v_message := replace(v_message, '{data}', COALESCE(to_char(r.due_date::date, 'DD/MM/YYYY'), '-'));
      v_message := replace(v_message, '{hora}', COALESCE(to_char(r.due_time, 'HH24:MI'), '-'));

      -- Incluir criador
      SELECT raw_user_meta_data->>'whatsapp' INTO v_phone FROM auth.users WHERE id = r.creator_id;
      IF v_phone IS NOT NULL AND trim(v_phone) != '' THEN
        v_phones := array_append(v_phones, trim(v_phone));
      END IF;

      -- Incluir mencionados
      FOR m IN 
        SELECT u.raw_user_meta_data->>'whatsapp' as phone
        FROM reminder_mentions rm
        JOIN auth.users u ON u.id = rm.user_id
        WHERE rm.reminder_id = r.id
      LOOP
        IF m.phone IS NOT NULL AND trim(m.phone) != '' AND NOT (v_phones @> ARRAY[trim(m.phone)]) THEN
          v_phones := array_append(v_phones, trim(m.phone));
        END IF;
      END LOOP;

      -- Disparar para cada numero
      FOREACH v_phone IN ARRAY v_phones
      LOOP
        v_phone := regexp_replace(v_phone, '\D', '', 'g');
        IF length(v_phone) >= 10 THEN
          IF v_phone NOT LIKE '55%' THEN
            v_phone := '55' || v_phone;
          END IF;

          v_payload := jsonb_build_object(
            'number', v_phone,
            'phone', v_phone,
            'text', v_message,
            'message', v_message
          );

          -- Endpoint principal
          PERFORM net.http_post(
            url := v_endpoint,
            body := v_payload,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (v_settings->>'token'),
                'apikey', (v_settings->>'token')
            ),
            timeout_milliseconds := 10000
          );

          -- Fallback (para garantir compatibilidade com diferentes versoes da API)
          PERFORM net.http_post(
            url := v_endpoint_fallback,
            body := v_payload,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (v_settings->>'token'),
                'apikey', (v_settings->>'token')
            ),
            timeout_milliseconds := 10000
          );
        END IF;
      END LOOP;

      -- Inserir notificacao in-app (SECURITY DEFINER garante acesso como superuser)
      INSERT INTO reminder_notifications (user_id, reminder_id, type, title, message)
      SELECT u, r.id, 'lembrete', 
             'Lembrete: ' || r.title, 
             COALESCE(r.description, 'Voce tem um lembrete pendente.')
      FROM unnest(ARRAY(
          SELECT user_id FROM reminder_mentions WHERE reminder_id = r.id
          UNION
          SELECT r.creator_id
      )) AS u;

      -- Marcar como notificado
      UPDATE reminders SET last_notified_at = now() WHERE id = r.id;

    END;
  END LOOP;
END;
$$;

-- 4. Garantir permissoes para a funcao
GRANT EXECUTE ON FUNCTION cron_send_reminders() TO postgres;

-- 5. Re-agendar o cron
DO $$
BEGIN
  PERFORM cron.unschedule('reminders_minutely');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
    'reminders_minutely',
    '* * * * *',
    $$ SELECT cron_send_reminders(); $$
);

-- 6. Verificar jobs ativos
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE '%reminder%';
