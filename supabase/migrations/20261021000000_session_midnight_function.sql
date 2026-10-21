-- =========================================================================
-- FUNÇÃO PARA OBTER TIMESTAMP DA PRÓXIMA MEIA-NOITE NO FUSO DO SERVIDOR
-- =========================================================================

-- Função que retorna o timestamp (epoch ms) da próxima meia-noite em UTC
-- considerando o fuso horário do servidor (America/Belem = UTC-3)
CREATE OR REPLACE FUNCTION get_next_midnight_server()
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_now timestamptz;
  v_midnight timestamptz;
BEGIN
  -- Obter hora atual no fuso do servidor (America/Belem)
  v_now := now() AT TIME ZONE 'America/Belem';
  
  -- Calcular próxima meia-noite (00:00:00 do dia seguinte)
  v_midnight := (v_now AT TIME ZONE 'America/Belem')::date + INTERVAL '1 day';
  
  -- Retornar como epoch em milissegundos (para consistência com Date.now() do JS)
  RETURN EXTRACT(EPOCH FROM v_midnight)::bigint * 1000;
END;
$$;

-- Grant para permitir chamada
GRANT EXECUTE ON FUNCTION get_next_midnight_server() TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_midnight_server() TO anon;
GRANT EXECUTE ON FUNCTION get_next_midnight_server() TO service_role;
