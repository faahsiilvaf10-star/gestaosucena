-- =============================================================================
-- FIX: Envio automático de Lembretes para Grupo WhatsApp quando marcado "Todos"
-- =============================================================================
-- Causa raiz 1: No envio para grupo, cron_send_reminders() montava o payload JSON
--               com 'groupId' sem o campo 'phone', fazendo a W-API responder 400:
--               "O número de telefone ou ID do grupo é obrigatório."
-- Causa raiz 2: Endpoint primário W-API deve usar /message/send-text (singular)
--               com fallback em /messages/send-text (plural).
-- Melhorias:
--   - Suporte explícito a recurrence_config->>'isAll', legado 'ALL' e contagem
--     total de usuários em auth.users.
--   - Isolamento por ambiente (hydro-civil vs barcarena) com fallback seguro.
--   - Inclusão do nome do criador na mensagem e notificações in-app para todos.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

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

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reminder_notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.cron_send_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_civil_groups jsonb;
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
  v_creator_name text;
  v_creator_phone text;
  v_is_advance boolean;
  v_advance_days integer;
BEGIN
  -- 1. Carregar configurações globais do WhatsApp
  SELECT value INTO v_settings FROM global_settings WHERE key = 'whatsapp_settings';

  IF v_settings IS NULL
     OR NULLIF(trim(v_settings->>'url'), '') IS NULL
     OR NULLIF(trim(v_settings->>'token'), '') IS NULL
     OR NULLIF(trim(v_settings->>'instanceId'), '') IS NULL THEN
    RETURN;
  END IF;

  v_reminders_enabled := COALESCE((v_settings->'reminders'->>'enabled')::boolean, false);
  IF NOT v_reminders_enabled THEN
    RETURN;
  END IF;

  SELECT value INTO v_civil_groups FROM global_settings WHERE key = 'whatsapp_groups_hydro-civil';

  -- 2. Horário atual (Fuso Pará/Brasília UTC-3)
  v_current_ts := now() AT TIME ZONE 'America/Belem';
  v_current_date := v_current_ts::date;
  v_current_time := to_char(v_current_ts, 'HH24:MI');
  v_current_dow := EXTRACT(DOW FROM v_current_ts);

  -- 3. Preparar endpoints W-API (/message/send-text primário, /messages/send-text fallback) / Evolution
  v_base_url := trim(trailing '/' from (v_settings->>'url'));

  IF v_base_url LIKE '%painel.w-api.app%' THEN
    v_base_url := 'https://api.w-api.app/v1';
  ELSIF v_base_url LIKE '%api.w-api.app%' AND v_base_url NOT LIKE '%/v1%' THEN
    v_base_url := v_base_url || '/v1';
  END IF;

  IF v_base_url LIKE '%api.w-api.app%' THEN
    v_endpoint := v_base_url || '/message/send-text?instanceId=' || (v_settings->>'instanceId');
    v_endpoint_fallback := v_base_url || '/messages/send-text?instanceId=' || (v_settings->>'instanceId');
  ELSE
    v_endpoint := v_base_url || '/message/sendText/' || (v_settings->>'instanceId');
    v_endpoint_fallback := v_base_url || '/messages/sendText/' || (v_settings->>'instanceId');
  END IF;

  -- 4. Percorrer todos os lembretes pendentes ou em andamento
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
      v_is_all_flag boolean := false;
      v_is_group_reminder boolean := false;
      v_group_id text;
      v_mention_count integer := 0;
      v_total_users integer := 0;
      v_all_users_count integer := 0;
      v_phones text[] := '{}';
      v_phone text;
    BEGIN
      -- Verificar se hoje é o dia do lembrete
      IF r.is_recurring THEN
        IF r.recurrence_config->'days' @> to_jsonb(v_current_dow) THEN
          v_is_target_day := true;
        END IF;
      ELSE
        IF r.due_date IS NOT NULL AND r.due_date::date <= v_current_date THEN
          v_is_target_day := true;
        END IF;
      END IF;

      -- Verificar se hoje é o dia de aviso antecipado
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

      -- Verificar horário
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

      -- Montar mensagem a partir dos templates configurados no Admin
      IF v_is_advance THEN
        v_message := COALESCE(
          NULLIF(v_settings->'messageTemplates'->>'lembreteAmanha', ''),
          '⏳ *Aviso Antecipado de Lembrete*' || chr(10) || chr(10) || '📌 *{titulo}*' || chr(10) || '_{descricao}_' || chr(10) || chr(10) || '📅 Data: {data}' || chr(10) || '⏰ Horário: {hora}'
        );
      ELSE
        v_message := COALESCE(
          NULLIF(v_settings->'messageTemplates'->>'lembreteHoje', ''),
          '🔔 *Lembrete Automático*' || chr(10) || chr(10) || '📌 *{titulo}*' || chr(10) || '_{descricao}_' || chr(10) || chr(10) || '📅 Data: {data}' || chr(10) || '⏰ Horário: {hora}'
        );
      END IF;

      SELECT
        COALESCE(
          NULLIF(trim(raw_user_meta_data->>'name'), ''),
          NULLIF(trim(raw_user_meta_data->>'nome'), ''),
          NULLIF(trim(raw_user_meta_data->>'full_name'), ''),
          'Usuário'
        ),
        COALESCE(
          raw_user_meta_data->>'whatsapp',
          raw_user_meta_data->>'phone',
          raw_user_meta_data->>'telefone'
        )
      INTO v_creator_name, v_creator_phone
      FROM auth.users
      WHERE id = r.creator_id;

      v_creator_name := COALESCE(v_creator_name, 'Usuário');

      v_message := replace(v_message, '{titulo}', COALESCE(r.title, ''));
      v_message := replace(v_message, '{descricao}', COALESCE(r.description, ''));
      v_message := replace(v_message, '{data}', COALESCE(
        to_char(r.due_date::date, 'DD/MM/YYYY'),
        to_char(v_current_date + (CASE WHEN v_is_advance THEN v_advance_days ELSE 0 END), 'DD/MM/YYYY')
      ));
      v_message := replace(v_message, '{hora}', COALESCE(to_char(r.due_time, 'HH24:MI'), '-'));

      IF position('{criador}' in v_message) > 0 THEN
        v_message := replace(v_message, '{criador}', v_creator_name);
      ELSE
        v_message := v_message || E'\n\n👤 Criado por: ' || v_creator_name;
      END IF;

      -- Resolver grupo do ambiente do lembrete
      IF r.environment = 'hydro-civil' THEN
        v_group_id := COALESCE(
          NULLIF(trim(v_civil_groups->>'reminders'), ''),
          NULLIF(trim(v_civil_groups->>'groupId'), '')
        );
      ELSE
        v_group_id := COALESCE(
          NULLIF(trim(v_settings->'reminders'->>'specificGroupId'), ''),
          NULLIF(trim(v_settings->>'groupId'), '')
        );
      END IF;

      -- Detectar se é lembrete para Todos (grupo) ou para usuários específicos (privado)
      SELECT COUNT(*) INTO v_mention_count
      FROM reminder_mentions
      WHERE reminder_id = r.id;

      SELECT COUNT(*) INTO v_total_users
      FROM auth.users;

      SELECT COUNT(*) INTO v_all_users_count
      FROM auth.users
      WHERE NULLIF(trim(COALESCE(
        raw_user_meta_data->>'whatsapp',
        raw_user_meta_data->>'phone',
        raw_user_meta_data->>'telefone',
        ''
      )), '') IS NOT NULL;

      v_is_all_flag := COALESCE((r.recurrence_config->>'isAll')::boolean, false)
        OR EXISTS (
          SELECT 1 FROM reminder_mentions
          WHERE reminder_id = r.id AND user_id::text = 'ALL'
        );

      v_is_group_reminder := v_is_all_flag
        OR (v_mention_count > 0 AND v_total_users > 0 AND v_mention_count >= v_total_users)
        OR (v_mention_count > 0 AND v_all_users_count > 0 AND v_mention_count >= v_all_users_count);

      IF v_group_id IS NULL THEN
        v_is_group_reminder := false;
      END IF;

      IF v_is_group_reminder THEN
        -- ===== ENVIO PARA O GRUPO CONFIGURADO =====
        -- IMPORTANTE: W-API exige o campo 'phone' preenchido com o ID do grupo (ex: 120363...@g.us)
        v_payload := jsonb_build_object(
          'number', v_group_id,
          'phone', v_group_id,
          'groupId', v_group_id,
          'text', v_message,
          'message', v_message
        );

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
      ELSE
        -- ===== ENVIO INDIVIDUAL (CRIADOR + MENCIONADOS) =====
        IF v_creator_phone IS NOT NULL AND trim(v_creator_phone) != '' THEN
          v_phones := array_append(v_phones, trim(v_creator_phone));
        END IF;

        FOR m IN
          SELECT COALESCE(
            u.raw_user_meta_data->>'whatsapp',
            u.raw_user_meta_data->>'phone',
            u.raw_user_meta_data->>'telefone'
          ) as phone
          FROM reminder_mentions rm
          JOIN auth.users u ON u.id::text = rm.user_id::text
          WHERE rm.reminder_id = r.id AND rm.user_id::text != 'ALL'
        LOOP
          IF m.phone IS NOT NULL AND trim(m.phone) != '' AND NOT (v_phones @> ARRAY[trim(m.phone)]) THEN
            v_phones := array_append(v_phones, trim(m.phone));
          END IF;
        END LOOP;

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
      END IF;

      -- Inserir notificação in-app para os envolvidos (todos se isAll, ou mencionados + criador)
      IF v_is_all_flag THEN
        INSERT INTO reminder_notifications (user_id, reminder_id, type, title, message)
        SELECT u, r.id, 'lembrete',
               '🔔 Lembrete: ' || r.title,
               COALESCE(r.description, 'Você tem um lembrete pendente.')
        FROM unnest(ARRAY(
          SELECT id FROM auth.users
          UNION
          SELECT user_id FROM reminder_mentions WHERE reminder_id = r.id AND user_id::text != 'ALL'
          UNION
          SELECT r.creator_id
        )) AS u
        WHERE u IS NOT NULL;
      ELSE
        INSERT INTO reminder_notifications (user_id, reminder_id, type, title, message)
        SELECT u, r.id, 'lembrete',
               '🔔 Lembrete: ' || r.title,
               COALESCE(r.description, 'Você tem um lembrete pendente.')
        FROM unnest(ARRAY(
          SELECT user_id FROM reminder_mentions WHERE reminder_id = r.id AND user_id::text != 'ALL'
          UNION
          SELECT r.creator_id
        )) AS u
        WHERE u IS NOT NULL;
      END IF;

      -- Marcar como notificado hoje
      UPDATE reminders SET last_notified_at = now() WHERE id = r.id;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cron_send_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.cron_send_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_send_reminders() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('reminders_minutely');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'reminders_minutely',
  '* * * * *',
  $$ SELECT public.cron_send_reminders(); $$
);
