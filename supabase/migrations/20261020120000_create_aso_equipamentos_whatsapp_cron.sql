-- ====================================================================================
-- MIGRATION: Adicionar ativadores de WhatsApp para ASO e Relatório de Equipamentos
-- Execute este script no SQL Editor do painel do Supabase.
-- ====================================================================================

-- 1. Habilitar extensão pg_cron se não existir
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ====================================================================================
-- FUNÇÃO: Enviar alerta de ASO vencendo
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.cron_send_aso_vencendo_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_json JSONB;
  enabled BOOLEAN;
  dias_antec INTEGER;
  group_id TEXT;
  api_url TEXT;
  api_token TEXT;
  instance_id TEXT;
  template_text TEXT;
  current_date DATE;
  target_date DATE;
  employee RECORD;
  message_text TEXT;
BEGIN
  -- Buscar configurações do WhatsApp
  SELECT value INTO settings_json
  FROM global_settings
  WHERE key = 'whatsapp_settings';

  IF settings_json IS NULL THEN
    RAISE NOTICE 'Configurações do WhatsApp não encontradas';
    RETURN;
  END IF;

  -- Verificar se o alerta de ASO está habilitado
  enabled := COALESCE((settings_json->'asoVencendo'->>'enabled')::BOOLEAN, false);
  IF NOT enabled THEN
    RETURN;
  END IF;

  dias_antec := COALESCE((settings_json->'asoVencendo'->>'diasAntecipacao')::INTEGER, 15);
  group_id := COALESCE(settings_json->'asoVencendo'->>'specificGroupId', settings_json->>'groupId', '');

  IF group_id = '' THEN
    RAISE NOTICE 'Grupo WhatsApp não configurado para alertas de ASO';
    RETURN;
  END IF;

  api_url := settings_json->>'url';
  api_token := settings_json->>'token';
  instance_id := settings_json->>'instanceId';
  template_text := COALESCE(
    settings_json->'messageTemplates'->>'asoVencendo',
    '⚠️ *AVISO: ASO VENCENDO* ⚠️\n\n📅 *Data do aviso:* {data_aviso}\n⏰ *Vencimento em:* {dias_vencendo} dia(s)\n\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📋 *Tipo de ASO:* {tipo_aso}\n📆 *Data de validade:* {data_validade}\n\n_Por favor, providencie a renovação do ASO._\n\n_Mensagem automática - Sucena_'
  );

  IF api_url = '' OR api_token = '' OR instance_id = '' THEN
    RAISE NOTICE 'Credenciais da API WhatsApp não configuradas';
    RETURN;
  END IF;

  current_date := CURRENT_DATE;
  target_date := current_date + dias_antec;

  -- Buscar funcionários com ASO vencendo no período
  FOR employee IN
    SELECT
      nome,
      cargo,
      matricula,
      validade_aso_efetiva,
      CASE
        WHEN validade_aso_efetiva = aso_admissional THEN 'Admissional'
        WHEN validade_aso_efetiva = aso_periodico THEN 'Periódico'
        WHEN validade_aso_efetiva = retorno_ao_trabalho THEN 'Retorno ao Trabalho'
        WHEN validade_aso_efetiva = mudanca_de_risco THEN 'Mudança de Risco'
        ELSE 'Desconhecido'
      END AS tipo_aso,
      GREATEST(aso_admissional, aso_periodico, retorno_ao_trabalho, mudanca_de_risco) AS data_validade_base
    FROM rh_efetivo
    WHERE status = 'Ativo'
      AND validade_aso_efetiva IS NOT NULL
      AND validade_aso_efetiva <= target_date
      AND validade_aso_efetiva >= current_date
    ORDER BY validade_aso_efetiva ASC
  LOOP
    -- Substituir variáveis no template
    message_text := template_text;
    message_text := REPLACE(message_text, '{data_aviso}', TO_CHAR(current_date, 'DD/MM/YYYY'));
    message_text := REPLACE(message_text, '{dias_vencendo}', CAST(dias_antec AS TEXT));
    message_text := REPLACE(message_text, '{nome}', COALESCE(employee.nome, 'N/A'));
    message_text := REPLACE(message_text, '{cargo}', COALESCE(employee.cargo, 'N/A'));
    message_text := REPLACE(message_text, '{matricula}', COALESCE(employee.matricula, 'N/A'));
    message_text := REPLACE(message_text, '{tipo_aso}', employee.tipo_aso);
    message_text := REPLACE(message_text, '{data_validade}', TO_CHAR(employee.data_validade_base, 'DD/MM/YYYY'));

    -- Enviar mensagem via API
    PERFORM net.http_post(
      url := api_url || '/message/sendText/' || instance_id,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || api_token
      ),
      body := jsonb_build_object(
        'number', group_id,
        'phone', group_id,
        'text', message_text,
        'message', message_text
      )
    );

    RAISE NOTICE 'Alerta de ASO enviado para: %', employee.nome;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cron_send_aso_vencendo_alerts() TO postgres;
GRANT EXECUTE ON FUNCTION public.cron_send_aso_vencendo_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_send_aso_vencendo_alerts() TO service_role;

-- ====================================================================================
-- FUNÇÃO: Enviar relatório diário de equipamentos
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.cron_send_daily_equipment_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_json JSONB;
  enabled BOOLEAN;
  group_id TEXT;
  hora_envio TEXT;
  api_url TEXT;
  api_token TEXT;
  instance_id TEXT;
  template_text TEXT;
  current_time TIME;
  current_date DATE;
  sending_time TIME;
  equipamentos_operando INTEGER := 0;
  equipamentos_manutencao INTEGER := 0;
  lista_manutencao TEXT := '';
  message_text TEXT;
  equipment RECORD;
BEGIN
  -- Buscar configurações do WhatsApp
  SELECT value INTO settings_json
  FROM global_settings
  WHERE key = 'whatsapp_settings';

  IF settings_json IS NULL THEN
    RAISE NOTICE 'Configurações do WhatsApp não encontradas';
    RETURN;
  END IF;

  -- Verificar se o relatório diário está habilitado
  enabled := COALESCE((settings_json->'relatorioDiarioEquipamentos'->>'enabled')::BOOLEAN, false);
  IF NOT enabled THEN
    RETURN;
  END IF;

  hora_envio := COALESCE(settings_json->'relatorioDiarioEquipamentos'->>'horaEnvio', '08:00');
  group_id := COALESCE(settings_json->'relatorioDiarioEquipamentos'->>'specificGroupId', settings_json->>'groupId', '');

  IF group_id = '' THEN
    RAISE NOTICE 'Grupo WhatsApp não configurado para relatório de equipamentos';
    RETURN;
  END IF;

  api_url := settings_json->>'url';
  api_token := settings_json->>'token';
  instance_id := settings_json->>'instanceId';
  template_text := COALESCE(
    settings_json->'messageTemplates'->>'relatorioDiarioEquipamentos',
    '📊 *RELATÓRIO DIÁRIO DE EQUIPAMENTOS*\n\n📅 *Data:* {data}\n🕐 *Hora:* {hora}\n\n✅ *Em operação:* {quantidade_operando}\n🔧 *Em manutenção:* {quantidade_manutencao}\n\n{lista_manutencao}\n\n_Mensagem automática - Sucena_'
  );

  IF api_url = '' OR api_token = '' OR instance_id = '' THEN
    RAISE NOTICE 'Credenciais da API WhatsApp não configuradas';
    RETURN;
  END IF;

  -- Verificar se é hora de enviar
  sending_time := hora_envio::TIME;
  current_time := CURRENT_TIME AT TIME ZONE 'America/Belem'; -- Fuso de Brasília
  current_date := CURRENT_DATE;

  -- Verificar se estamos no minuto certo (margem de 1 minuto)
  IF ABS(EXTRACT(MINUTE FROM current_time) - EXTRACT(MINUTE FROM sending_time)) > 1 THEN
    RETURN;
  END IF;

  -- Contar equipamentos em operação
  SELECT COUNT(*) INTO equipamentos_operando
  FROM eq_equipments
  WHERE location_status = 'inside';

  -- Buscar equipamentos em manutenção e montar lista
  FOR equipment IN
    SELECT
      name,
      tag,
      last_exit_reason,
      updated_at
    FROM eq_equipments
    WHERE location_status = 'outside'
      AND last_exit_reason IN ('manutencao', 'manutenção', 'preventiva', 'corretiva', 'emergencial')
    ORDER BY name ASC
  LOOP
    equipamentos_manutencao := equipamentos_manutencao + 1;

    -- Calcular tempo em manutenção
    DECLARE
      tempo_manutencao TEXT;
      minutos_diff BIGINT;
      horas_diff BIGINT;
      dias_diff BIGINT;
    BEGIN
      minutos_diff := EXTRACT(EPOCH FROM (NOW() - equipment.updated_at)) / 60;

      IF minutos_diff < 60 THEN
        tempo_manutencao := CAST(FLOOR(minutos_diff) AS TEXT) || 'min';
      ELSIF minutos_diff < 1440 THEN
        horas_diff := minutos_diff / 60;
        tempo_manutencao := CAST(FLOOR(horas_diff) AS TEXT) || 'h';
      ELSE
        dias_diff := minutos_diff / 1440;
        tempo_manutencao := CAST(FLOOR(dias_diff) AS TEXT) || 'd';
      END IF;
    END;

    lista_manutencao := lista_manutencao || '🔧 ' || COALESCE(equipment.name, 'N/A') ||
                        ' (' || COALESCE(equipment.tag, 'N/A') || ') - ' ||
                        COALESCE(tempo_manutencao, '?') || '\n';
  END LOOP;

  -- Montar mensagem final
  message_text := template_text;
  message_text := REPLACE(message_text, '{data}', TO_CHAR(current_date, 'DD/MM/YYYY'));
  message_text := REPLACE(message_text, '{hora}', TO_CHAR(current_time, 'HH24:MI'));
  message_text := REPLACE(message_text, '{quantidade_operando}', CAST(equipamentos_operando AS TEXT));
  message_text := REPLACE(message_text, '{quantidade_manutencao}', CAST(equipamentos_manutencao AS TEXT));

  IF lista_manutencao = '' THEN
    message_text := REPLACE(message_text, '{lista_manutencao}', '_(Nenhum equipamento em manutenção)_');
  ELSE
    message_text := REPLACE(message_text, '{lista_manutencao}', '🔧 *Em manutenção:*\n' || lista_manutencao);
  END IF;

  -- Enviar mensagem via API
  PERFORM net.http_post(
    url := api_url || '/message/sendText/' || instance_id,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_token
    ),
    body := jsonb_build_object(
      'number', group_id,
      'phone', group_id,
      'text', message_text,
      'message', message_text
    )
  );

  RAISE NOTICE 'Relatório diário de equipamentos enviado: % em operação, % em manutenção',
    equipamentos_operando, equipamentos_manutencao;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cron_send_daily_equipment_report() TO postgres;
GRANT EXECUTE ON FUNCTION public.cron_send_daily_equipment_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_send_daily_equipment_report() TO service_role;

-- ====================================================================================
-- AGENDAMENTO: Configurar os crons (executa a cada minuto para verificar horário)
-- ====================================================================================

-- Cron para ASO vencendo (executa todo dia às 08:00)
SELECT cron.unschedule('aso_vencendo_alert');
SELECT cron.schedule(
  'aso_vencendo_alert',
  '0 8 * * *', -- Todo dia às 08:00
  $$ SELECT public.cron_send_aso_vencendo_alerts(); $$
);

-- Cron para relatório diário de equipamentos (executa todo dia)
SELECT cron.unschedule('daily_equipment_report');
SELECT cron.schedule(
  'daily_equipment_report',
  '* * * * *', -- A cada minuto para verificar se é hora de enviar
  $$ SELECT public.cron_send_daily_equipment_report(); $$
);

-- ====================================================================================
-- VERIFICAÇÃO: Listar crons ativos
-- ====================================================================================
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('aso_vencendo_alert', 'daily_equipment_report');
