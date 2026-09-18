-- =========================================================================
-- FUNÇÃO DE LEMBRETE AUTOMÁTICO DE TAREFAS/LEMBRETES (SUPABASE PG_CRON)
-- =========================================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. Adicionar controle de notificação
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

-- 3. Função principal
CREATE OR REPLACE FUNCTION cron_send_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings jsonb;
  v_reminders_enabled boolean;
  v_default_group text;
  v_endpoint text;
  
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

  -- Preparar o Endpoint (mesma lógica do frontend)
  v_endpoint := trim(trailing '/' from (v_settings->>'url'));
  IF v_endpoint LIKE '%painel.w-api.app%' THEN
    v_endpoint := 'https://api.w-api.app/message/sendText/' || (v_settings->>'instanceId');
  ELSE
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
    BEGIN
      -- 1. Verificar se hoje é o dia do lembrete
      IF r.is_recurring THEN
        IF r.recurrence_config->'days' @> to_jsonb(v_current_dow) THEN
          v_is_target_day := true;
        END IF;
      ELSE
        IF r.due_date IS NOT NULL AND r.due_date::date = v_current_date THEN
          v_is_target_day := true;
        END IF;
      END IF;

      -- 2. Verificar se hoje é o dia de AVISO ANTECIPADO
      IF v_advance_days > 0 THEN
        IF r.is_recurring THEN
          -- Ex: se repete terça (2), e avisa 1 dia antes, então segunda (1) é dia de aviso
          -- dow_alvo - advance_days = dow_hoje
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
          IF to_char(r.due_time, 'HH24:MI') = v_current_time THEN
            v_trigger_now := true;
            v_is_advance := false;
          END IF;
        ELSE
          -- Sem horário configurado = 06:00
          IF v_current_time = '06:00' THEN
            v_trigger_now := true;
            v_is_advance := false;
          END IF;
        END IF;
      END IF;

      IF v_is_advance_day AND NOT v_trigger_now THEN
        -- Aviso antecipado sempre às 16:00
        IF v_current_time = '16:00' THEN
          v_trigger_now := true;
          v_is_advance := true;
        END IF;
      END IF;

      -- Se não for pra disparar, continua o loop
      IF NOT v_trigger_now THEN
        CONTINUE;
      END IF;

      -- Se já notificamos ESTE lembrete HOJE no mesmo minuto, não envia de novo
      IF r.last_notified_at IS NOT NULL 
         AND (r.last_notified_at AT TIME ZONE 'America/Belem')::date = v_current_date
         AND to_char(r.last_notified_at AT TIME ZONE 'America/Belem', 'HH24:MI') = v_current_time THEN
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
      v_message := replace(v_message, '{descricao}', COALESCE(r.description, ''));
      v_message := replace(v_message, '{data}', COALESCE(to_char(r.due_date::date, 'DD/MM/YYYY'), '-'));
      v_message := replace(v_message, '{hora}', COALESCE(to_char(r.due_time, 'HH24:MI'), '-'));

      -- VERIFICAR DESTINATÁRIOS
      v_mentions_all := false;
      
      DECLARE
        v_phones text[] := '{}';
        v_phone text;
        v_total_users int;
        v_mentioned_users int;
      BEGIN
        SELECT count(*) INTO v_total_users FROM get_users();
        SELECT count(*) INTO v_mentioned_users FROM reminder_mentions WHERE reminder_id = r.id;

        -- Heurística: Se não tiver NENHUMA menção (apenas para si mesmo ou todos),
        -- ou se mencionou TODO MUNDO do sistema (ou quase), enviamos para o GRUPO.
        -- OBS: A imagem diz: "Se mencionar todos -> vai para o grupo configurado; senão -> privado".
        -- Como no form se não colocar menção é só pra ele, talvez devesse ser privado. 
        -- Porém, se for 0 menções MAS o grupo estiver configurado? Na verdade 0 menções vai pro criador no privado se ele não botou Todos.
        -- No form, se seleciona "Todos", ele joga todos os IDs do sistema. 
        -- Portanto, se número de menções >= (total_users - 1) (em cenários com mais de 2 usuários), é "Todos".
        -- Se houver apenas 1 ou 2 usuários, exige-se que seja >= total_users para evitar que "Eu" (1 usuário) acione o envio para o Grupo.
        IF v_total_users > 2 THEN
          IF v_mentioned_users >= (v_total_users - 1) AND v_mentioned_users > 0 THEN
            v_mentions_all := true;
          END IF;
        ELSE
          IF v_mentioned_users >= v_total_users AND v_total_users > 0 THEN
            v_mentions_all := true;
          END IF;
        END IF;

        IF v_mentions_all AND v_default_group IS NOT NULL AND v_default_group != '' THEN
          -- ENVIA PARA O GRUPO
          v_payload := jsonb_build_object(
            'number', v_default_group,
            'phone', v_default_group,
            'text', v_message,
            'message', v_message
          );

          PERFORM net.http_post(
            url := v_endpoint,
            body := v_payload,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (v_settings->>'token')
            )
          );
        ELSE
          -- ENVIA NO PRIVADO (Criador + Mencionados)
          -- Incluir o criador
          SELECT raw_user_meta_data->>'whatsapp' INTO v_phone FROM auth.users WHERE id = r.creator_id;
          -- Fallback: se o criador não tem WhatsApp cadastrado, usa o adminPhone das configurações
          IF v_phone IS NULL OR v_phone = '' THEN
            v_phone := v_settings->>'adminPhone';
          END IF;
          IF v_phone IS NOT NULL AND v_phone != '' THEN
            v_phones := array_append(v_phones, v_phone);
          END IF;

          -- Incluir os mencionados
          FOR m IN 
            SELECT u.raw_user_meta_data->>'whatsapp' as phone
            FROM reminder_mentions rm
            JOIN auth.users u ON u.id = rm.user_id
            WHERE rm.reminder_id = r.id
          LOOP
            IF m.phone IS NOT NULL AND m.phone != '' AND NOT (v_phones @> ARRAY[m.phone]) THEN
              v_phones := array_append(v_phones, m.phone);
            END IF;
          END LOOP;

          -- Disparar para cada número no privado
          FOREACH v_phone IN ARRAY v_phones
          LOOP
            -- Normalizar número: adicionar prefixo 55 (Brasil) se necessário
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
                  'Authorization', 'Bearer ' || (v_settings->>'token')
              )
            );
          END LOOP;
        END IF;
      END;

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
