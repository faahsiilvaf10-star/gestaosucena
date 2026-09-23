-- =========================================================================
-- FUNÇÃO DE LEMBRETE AUTOMÁTICO DE TAREFAS/LEMBRETES (SUPABASE PG_CRON)
-- =========================================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. Adicionar controle de notificação
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

-- 2b. Garantir que a política de INSERT em reminder_notifications permite
-- que o pg_cron (roda como role postgres, não autenticado) insira notificações.
-- Sem isso, o cron insere no WhatsApp mas NUNCA cria a notificação in-app,
-- portanto o Realtime nunca dispara e o usuário não vê o alerta no app.
DROP POLICY IF EXISTS "Sistema pode inserir notificacoes" ON public.reminder_notifications;
CREATE POLICY "Sistema pode inserir notificacoes"
  ON public.reminder_notifications
  FOR INSERT
  WITH CHECK (true);
GRANT INSERT ON public.reminder_notifications TO service_role;
GRANT INSERT ON public.reminder_notifications TO postgres;
GRANT SELECT ON public.reminder_notifications TO postgres;
GRANT UPDATE ON public.reminders TO postgres;
GRANT SELECT ON public.reminders TO postgres;
GRANT SELECT ON public.reminder_mentions TO postgres;

-- Garantir que a tabela está no Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reminder_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Função principal
CREATE OR REPLACE FUNCTION cron_send_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_reminders_enabled boolean;
  v_default_group text;
  v_endpoint text;
  v_endpoint_fallback text; -- Fallback para compatibilidade com diferentes versões da API
  
  v_current_ts timestamptz;
  v_current_date date;
  v_current_time text; -- HH:MM
  v_current_dow integer; -- 0 (Sun) to 6 (Sat)
  
  r record;
  m record;
  v_payload jsonb;
  v_message text;
  v_target text;
  v_mentions_all boolean;
  v_is_advance boolean;
  v_advance_days integer;
BEGIN
  -- Carregar configurações
  SELECT value INTO v_settings FROM global_settings WHERE key = 'whatsapp_settings';
  
  IF v_settings IS NULL OR v_settings->>'url' IS NULL OR v_settings->>'token' IS NULL THEN
    RETURN;
  END IF;

  v_reminders_enabled := (v_settings->'reminders'->>'enabled')::boolean;
  v_default_group := COALESCE(v_settings->'reminders'->>'specificGroupId', v_settings->>'groupId');

  IF v_reminders_enabled IS NULL OR NOT v_reminders_enabled THEN
    RETURN;
  END IF;

  -- Horários atuais (Fuso do Pará UTC-3, America/Belem)
  v_current_ts := now() AT TIME ZONE 'America/Belem';
  v_current_date := v_current_ts::date;
  v_current_time := to_char(v_current_ts, 'HH24:MI');
  
  -- Dia da semana (0=Dom, 1=Seg...6=Sáb) compatível com o Javascript getDay()
  v_current_dow := EXTRACT(DOW FROM v_current_ts);

  -- Preparar o Endpoint e Headers (mesma lógica do frontend whatsapp-api.ts)
  v_endpoint := trim(trailing '/' from (v_settings->>'url'));
  
  -- Converter URL se for W-API
  IF v_endpoint LIKE '%painel.w-api.app%' THEN
    v_endpoint := 'https://api.w-api.app/v1';
  ELSIF v_endpoint LIKE '%api.w-api.app%' AND v_endpoint NOT LIKE '%/v1%' THEN
    v_endpoint := v_endpoint || '/v1';
  END IF;

  -- Montar endpoint final
  -- NOTA: A W-API usa /messages/ (plural) com /send-text.
  -- O frontend (whatsapp-api.ts linha 28) já usa plural corretamente.
  -- O cron também deve usar plural como endpoint principal.
  IF v_endpoint LIKE '%api.w-api.app%' THEN
    -- W-API: endpoint correto usa plural /messages/send-text
    v_endpoint := v_endpoint || '/messages/send-text?instanceId=' || (v_settings->>'instanceId');
  ELSE
    -- Padrão da Evolution API v1 original
    v_endpoint := v_endpoint || '/message/sendText/' || (v_settings->>'instanceId');
  END IF;

  -- Percorrer todos os lembretes pendentes ou em andamento
  FOR r IN 
    SELECT * FROM reminders 
    WHERE status IN ('Pendente', 'Em andamento')
  LOOP
    v_is_advance := false;
    v_advance_days := COALESCE((r.recurrence_config->>'advanceNotice')::integer, 0);

    -- VERIFICAR SE DEVE DISPARAR AGORA
    DECLARE
      v_trigger_now boolean := false;
      v_is_target_day boolean := false;
      v_is_advance_day boolean := false;
      v_phones text[] := '{}';
      v_phone text;
    BEGIN
      -- 1. Verificar se hoje é o dia do lembrete
      IF r.is_recurring THEN
        IF r.recurrence_config->'days' @> to_jsonb(v_current_dow) THEN
          v_is_target_day := true;
        END IF;
      ELSE
        IF r.due_date IS NOT NULL AND r.due_date::date <= v_current_date THEN
          v_is_target_day := true;
        END IF;
      END IF;

      -- 2. Verificar se hoje é o dia de AVISO ANTECIPADO
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

      -- 3. Bateu o horário?
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

      IF r.last_notified_at IS NOT NULL 
         AND (r.last_notified_at AT TIME ZONE 'America/Belem')::date = v_current_date THEN
        CONTINUE;
      END IF;

      -- MONTAR A MENSAGEM
      IF v_is_advance THEN
        v_message := COALESCE(
          v_settings->'messageTemplates'->>'lembreteAmanha',
          '⏳ *Aviso Antecipado de Lembrete*' || chr(10) || chr(10) || '📌 *{titulo}*' || chr(10) || '_{descricao}_' || chr(10) || chr(10) || '📅 Data: {data}' || chr(10) || '⏰ Horário: {hora}'
        );
      ELSE
        v_message := COALESCE(
          v_settings->'messageTemplates'->>'lembreteHoje',
          '🔔 *Lembrete Automático*' || chr(10) || chr(10) || '📌 *{titulo}*' || chr(10) || '_{descricao}_' || chr(10) || chr(10) || '📅 Data: {data}' || chr(10) || '⏰ Horário: {hora}'
        );
      END IF;

      v_message := replace(v_message, '{titulo}', r.title);
      v_message := replace(v_message, '{descricao}',COALESCE(r.description, ''));
      v_message := replace(v_message, '{data}',     COALESCE(
        to_char(r.due_date::date, 'DD/MM/YYYY'), 
        to_char(v_current_date + (CASE WHEN v_is_advance THEN v_advance_days ELSE 0 END), 'DD/MM/YYYY')
      ));
      v_message := replace(v_message, '{hora}',     COALESCE(to_char(r.due_time, 'HH24:MI'), '-'));

      -- 1. Incluir o criador (se tiver WhatsApp configurado)
      SELECT raw_user_meta_data->>'whatsapp' INTO v_phone FROM auth.users WHERE id = r.creator_id;
      IF v_phone IS NOT NULL AND trim(v_phone) != '' THEN
        v_phones := array_append(v_phones, trim(v_phone));
      END IF;

      -- 2. Incluir os mencionados (se tiverem WhatsApp configurado)
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

      -- 3. Disparar individualmente para cada número encontrado
      FOREACH v_phone IN ARRAY v_phones
      LOOP
        v_phone := regexp_replace(v_phone, '\D', '', 'g');
        -- Só enviar se tiver um número válido (mínimo 10 dígitos)
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

          -- Fallback (endpoint alternativo) para compatibilidade com versões diferentes da API
          -- W-API: testa singular caso o plural não funcione (e vice-versa para Evolution)
          IF v_endpoint LIKE '%api.w-api.app%' THEN
            v_endpoint_fallback := replace(v_endpoint, '/messages/send-text', '/message/send-text');
          ELSE
            v_endpoint_fallback := replace(v_endpoint, '/message/sendText/', '/messages/sendText/');
          END IF;

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

      -- INSERIR NOTIFICAÇÃO IN-APP PARA OS ENVOLVIDOS
      -- SECURITY DEFINER + SET search_path garantem que isso funciona sem usuário autenticado
      INSERT INTO reminder_notifications (user_id, reminder_id, type, title, message)
      SELECT u, r.id, 'lembrete', '🔔 Lembrete: ' || r.title, COALESCE(r.description, 'Você tem um lembrete pendente.')
      FROM unnest(ARRAY(
          SELECT user_id FROM reminder_mentions WHERE reminder_id = r.id
          UNION
          SELECT r.creator_id
      )) AS u;

      -- Marcar como notificado para evitar repetição no mesmo minuto
      UPDATE reminders SET last_notified_at = now() WHERE id = r.id;

    END;
  END LOOP;
END;
$$;

-- 4. Agendar para rodar A CADA MINUTO
DO $$
BEGIN
  PERFORM cron.unschedule('reminders_minutely');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar se não existir
END $$;

SELECT cron.schedule(
    'reminders_minutely',
    '* * * * *',
    $$ SELECT cron_send_reminders(); $$
);
