-- Fix DDS WhatsApp cron for the current W-API endpoint and authentication headers.
CREATE OR REPLACE FUNCTION public.cron_send_dds_reminder(is_today boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings jsonb;
  v_dds record;
  v_target_date date;
  v_message text;
  v_endpoint text;
  v_payload jsonb;
  v_target_group text;
  v_speaker_phone text;
  v_speaker_name text;
  v_tema_str text;
  v_enabled boolean;
BEGIN
  SELECT value INTO v_settings
  FROM public.global_settings
  WHERE key = 'whatsapp_settings';

  IF v_settings IS NULL
     OR NULLIF(v_settings->>'url', '') IS NULL
     OR NULLIF(v_settings->>'token', '') IS NULL
     OR NULLIF(v_settings->>'instanceId', '') IS NULL THEN
    RETURN;
  END IF;

  IF is_today THEN
    v_enabled := COALESCE((v_settings->'ddsReminders'->>'enabled_0600')::boolean, false);
  ELSE
    v_enabled := COALESCE((v_settings->'ddsReminders'->>'enabled_1600')::boolean, false);
  END IF;

  IF NOT v_enabled THEN
    RETURN;
  END IF;

  v_target_group := COALESCE(
    NULLIF(v_settings->'ddsReminders'->>'specificGroupId', ''),
    NULLIF(v_settings->>'groupId', '')
  );

  v_target_date := (now() AT TIME ZONE 'America/Belem')::date;
  IF NOT is_today THEN
    v_target_date := v_target_date + 1;
  END IF;

  SELECT id, tema, palestrante_id
  INTO v_dds
  FROM public.seguranca_dds
  WHERE date = v_target_date
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    raw_user_meta_data->>'whatsapp',
    COALESCE(
      raw_user_meta_data->>'nome',
      raw_user_meta_data->>'full_name',
      'Não informado'
    )
  INTO v_speaker_phone, v_speaker_name
  FROM auth.users
  WHERE id = v_dds.palestrante_id;

  v_tema_str := CASE
    WHEN NULLIF(trim(v_dds.tema), '') IS NULL THEN '*Tema:* A definir'
    ELSE '*Tema:* ' || v_dds.tema
  END;

  IF is_today THEN
    v_message := COALESCE(
      v_settings->'messageTemplates'->>'ddsHoje',
      '🎤 *Lembrete DDS - Hoje*' || chr(10) || chr(10) ||
      '👤 *Palestrante:* {palestrante}' || chr(10) ||
      '📅 *Data:* {data} (hoje)' || chr(10) ||
      '📋 {tema}'
    );
  ELSE
    v_message := COALESCE(
      v_settings->'messageTemplates'->>'ddsAmanha',
      '🎤 *Aviso Prévio DDS - Amanhã*' || chr(10) || chr(10) ||
      '👤 *Palestrante:* {palestrante}' || chr(10) ||
      '📅 *Data:* {data} (amanhã)' || chr(10) ||
      '📋 {tema}'
    );
  END IF;

  v_message := replace(v_message, '{palestrante}', COALESCE(v_speaker_name, 'Não informado'));
  v_message := replace(v_message, '{data}', to_char(v_target_date, 'DD/MM/YYYY'));
  v_message := replace(v_message, '{tema}', v_tema_str);

  v_endpoint := trim(trailing '/' FROM (v_settings->>'url'));
  IF v_endpoint LIKE '%painel.w-api.app%' THEN
    v_endpoint := 'https://api.w-api.app/v1/messages/send-text?instanceId=' || (v_settings->>'instanceId');
  ELSIF v_endpoint LIKE '%api.w-api.app%' THEN
    IF v_endpoint NOT LIKE '%/v1' THEN
      v_endpoint := v_endpoint || '/v1';
    END IF;
    v_endpoint := v_endpoint || '/messages/send-text?instanceId=' || (v_settings->>'instanceId');
  ELSE
    v_endpoint := v_endpoint || '/message/sendText/' || (v_settings->>'instanceId');
  END IF;

  IF is_today AND v_target_group IS NOT NULL THEN
    v_payload := jsonb_build_object(
      'number', v_target_group,
      'phone', v_target_group,
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
      )
    );
  ELSIF NOT is_today AND NULLIF(v_speaker_phone, '') IS NOT NULL THEN
    v_payload := jsonb_build_object(
      'number', v_speaker_phone,
      'phone', v_speaker_phone,
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
      )
    );
  END IF;
END;
$$;
