-- =========================================================================
-- FUNÇÃO DE LEMBRETE AUTOMÁTICO DO DDS (SUPABASE PG_CRON + PG_NET)
-- =========================================================================

-- 1. Habilitar extensões necessárias no Supabase
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. Criar a função que verifica e envia a mensagem
CREATE OR REPLACE FUNCTION cron_send_dds_reminder(is_today boolean)
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
  v_payload_group jsonb;
  v_payload_private jsonb;
  v_req_id_group bigint;
  v_req_id_private bigint;
  v_target_group text;
  v_speaker_phone text;
  v_speaker_name text;
  v_tema_str text;
  v_enabled boolean;
BEGIN
  -- Carregar configurações do WhatsApp
  SELECT value INTO v_settings FROM global_settings WHERE key = 'whatsapp_settings';
  
  IF v_settings IS NULL OR v_settings->>'url' IS NULL OR v_settings->>'token' IS NULL THEN
    RETURN;
  END IF;

  -- Verificar se está habilitado
  IF is_today THEN
    v_enabled := (v_settings->'ddsReminders'->>'enabled_0600')::boolean;
  ELSE
    v_enabled := (v_settings->'ddsReminders'->>'enabled_1600')::boolean;
  END IF;

  IF v_enabled IS NULL OR NOT v_enabled THEN
    RETURN;
  END IF;

  -- Definir o grupo alvo (específico do DDS ou o geral)
  v_target_group := COALESCE(
    NULLIF(v_settings->'ddsReminders'->>'specificGroupId', ''), 
    v_settings->>'groupId'
  );

  -- Lógica de Horário (Pará é UTC-3)
  v_target_date := (now() AT TIME ZONE 'America/Belem')::date;
  IF NOT is_today THEN
    v_target_date := v_target_date + interval '1 day';
  END IF;

  -- Buscar o DDS do dia alvo (Apenas 1 caso existam vários)
  SELECT id, tema, palestrante_id INTO v_dds 
  FROM seguranca_dds 
  WHERE date = v_target_date
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN; -- Nenhum DDS agendado
  END IF;

  -- Buscar número de WhatsApp e Nome do palestrante (se existir)
  SELECT raw_user_meta_data->>'whatsapp',
         COALESCE(raw_user_meta_data->>'nome', raw_user_meta_data->>'full_name', 'Não informado') 
  INTO v_speaker_phone, v_speaker_name
  FROM auth.users 
  WHERE id = v_dds.palestrante_id;

  -- Tratar o tema
  IF v_dds.tema IS NOT NULL AND trim(v_dds.tema) != '' THEN
    v_tema_str := '*Tema:* ' || v_dds.tema;
  ELSE
    v_tema_str := '*Tema:* A definir';
  END IF;

  -- Formatar Mensagem
  IF is_today THEN
    v_message := COALESCE(
      v_settings->'messageTemplates'->>'ddsHoje',
      '🎤 *Lembrete DDS - Hoje*' || chr(10) || chr(10) || '👤 *Palestrante:* {palestrante}' || chr(10) || '📅 *Data:* {data} (hoje)' || chr(10) || '📋 {tema}' || chr(10) || chr(10) || '_Mensagem automática - Sucena_'
    );
  ELSE
    v_message := COALESCE(
      v_settings->'messageTemplates'->>'ddsAmanha',
      '🎤 *Aviso Prévio DDS - Amanhã*' || chr(10) || chr(10) || '👤 *Palestrante:* {palestrante}' || chr(10) || '📅 *Data:* {data} (amanhã)' || chr(10) || '📋 {tema}' || chr(10) || chr(10) || '_Mensagem automática - Sucena_'
    );
  END IF;

  v_message := replace(v_message, '{palestrante}', COALESCE(v_speaker_name, 'Não informado'));
  v_message := replace(v_message, '{data}', to_char(v_target_date, 'DD/MM/YYYY'));
  v_message := replace(v_message, '{tema}', v_tema_str);

  -- Preparar o Endpoint
  v_endpoint := trim(trailing '/' from (v_settings->>'url'));
  IF v_endpoint LIKE '%painel.w-api.app%' THEN
    v_endpoint := 'https://api.w-api.app/message/sendText/' || (v_settings->>'instanceId');
  ELSE
    v_endpoint := v_endpoint || '/message/sendText/' || (v_settings->>'instanceId');
  END IF;

  -- 1. Enviar para o Grupo (Apenas no dia do DDS às 06:00)
  IF is_today AND v_target_group IS NOT NULL AND v_target_group != '' THEN
    v_payload_group := jsonb_build_object(
      'number', v_target_group,
      'phone', v_target_group,
      'text', v_message,
      'message', v_message
    );

    SELECT net.http_post(
        url := v_endpoint,
        body := v_payload_group,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (v_settings->>'token')
        )
    ) INTO v_req_id_group;
  END IF;

  -- 2. Enviar para o Palestrante no privado (Apenas no aviso prévio às 16:00)
  IF NOT is_today AND v_speaker_phone IS NOT NULL AND v_speaker_phone != '' THEN
    -- Remove caracteres não numéricos para garantir formato válido (opcional, dependendo de como salvam)
    -- Assumindo que a W-API entende números do Brasil se vier formatado razoavelmente.
    
    v_payload_private := jsonb_build_object(
      'number', v_speaker_phone,
      'phone', v_speaker_phone,
      'text', v_message,
      'message', v_message
    );

    SELECT net.http_post(
        url := v_endpoint,
        body := v_payload_private,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (v_settings->>'token')
        )
    ) INTO v_req_id_private;
  END IF;

END;
$$;

-- 3. Configurar os Agendamentos Diários (Cron Jobs)
-- Remover agendamentos anteriores (caso existam) para não duplicar
DO $$
BEGIN
  PERFORM cron.unschedule('dds_lembrete_0600');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar se não existir
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('dds_aviso_1600');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar se não existir
END $$;

-- Agendar para 06:00 do fuso de Brasília/Pará (UTC-3). Portanto, 09:00 UTC.
SELECT cron.schedule(
    'dds_lembrete_0600',
    '0 9 * * *',
    $$ SELECT cron_send_dds_reminder(true); $$
);

-- Agendar para 16:00 do fuso de Brasília/Pará (UTC-3). Portanto, 19:00 UTC.
SELECT cron.schedule(
    'dds_aviso_1600',
    '0 19 * * *',
    $$ SELECT cron_send_dds_reminder(false); $$
);
