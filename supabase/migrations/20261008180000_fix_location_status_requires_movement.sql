-- ============================================================================
-- Fix: "equipamento aparece como Fora da Obra sem existir registro de saída"
--
-- CAUSA RAIZ
-- ----------
-- 1. O status de localização (`eq_equipments.location_status`) era gravado por
--    processos que NÃO são registro de portaria:
--      - reset de jornada em /equipamentos/parte-diaria
--      - fim de turno e auto-reset de meia-noite no app do motorista
--    Todos gravavam `location_status: 'outside'` sem inserir movimento em
--    `eq_movements`. Resultado: veículo parado NA obra marcado como fora.
--
-- 2. Não havia integridade entre `eq_movements` e `eq_equipments`: qualquer
--    UPDATE direto podia divergir as duas tabelas e nada reconciliava.
--
-- 3. Equipamentos sem nenhum movimento liam `NULL` como "fora" em uma tela
--    e como "dentro" em outra (semântica oposta entre RDO e as demais).
--
-- CORREÇÃO
-- --------
-- - Reconcilia o cache `location_status` a partir do ÚLTIMO MOVIMENTO REAL.
--   Sem movimento => 'inside' (dentro), pois nada foi registrado como saída.
--   Este passo arruma os equipamentos já quebrados (CP 02/04/05/06).
-- - Trigger que mantém o cache em sincronia com `eq_movements`, para que
--   INSERT/UPDATE/DELETE de movimentos (inclusive da fila offline do app do
--   motorista) reflitam automaticamente no equipamento.
-- - Guard que BLOQUEIA alterações diretas de localização que não venham de
--   um registro de portaria.
-- - `eq_register_movement()`: grava o movimento e atualiza o equipamento de
--   forma atômica, garantindo que nunca exista "fora" sem registro de saída.
-- ============================================================================

-- Libera o guard de escrita durante a própria reconciliação, para que a
-- migration possa ser reaplicada com segurança (idempotente).
SELECT set_config('eq.movement_sync', 'on', true);
DROP TRIGGER IF EXISTS eq_guard_location_status_write_trg ON public.eq_equipments;

-- ----------------------------------------------------------------------------
-- 1. Garante que a coluna existe e tem domínio binário fechado
-- ----------------------------------------------------------------------------
ALTER TABLE public.eq_equipments
  ADD COLUMN IF NOT EXISTS location_status TEXT DEFAULT 'inside';

-- Valores fora do domínio viram 'inside' para não violar o CHECK já existente.
UPDATE public.eq_equipments
SET location_status = 'inside'
WHERE location_status IS DISTINCT FROM 'inside'
  AND location_status IS DISTINCT FROM 'outside';

-- NOT NULL elimina o estado ambíguo "desconhecido": sem movimento registrado
-- o padrão é DENTRO da obra.
UPDATE public.eq_equipments
SET location_status = 'inside'
WHERE location_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'eq_equipments'
      AND column_name = 'location_status' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.eq_equipments
      ALTER COLUMN location_status SET DEFAULT 'inside',
      ALTER COLUMN location_status SET NOT NULL;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. Reconciliação: só existe "fora da obra" se o último movimento for saída
-- ----------------------------------------------------------------------------
WITH last_mov AS (
  SELECT DISTINCT ON (equipment_id) equipment_id, movement_type
  FROM public.eq_movements
  ORDER BY equipment_id, created_at DESC, id DESC
)
UPDATE public.eq_equipments eq
SET location_status = CASE
      WHEN (SELECT movement_type FROM last_mov WHERE equipment_id = eq.id) = 'exit'
        THEN 'outside'
      ELSE 'inside'
    END,
    updated_at = TIMEZONE('utc'::text, NOW())
WHERE eq.location_status IS DISTINCT FROM CASE
      WHEN (SELECT movement_type FROM last_mov WHERE equipment_id = eq.id) = 'exit'
        THEN 'outside'
      ELSE 'inside'
    END;

-- Motivo/descrição só existem junto de uma SAÍDA registrada como última.
WITH last_exit AS (
  SELECT DISTINCT ON (equipment_id) equipment_id, exit_reason, description
  FROM public.eq_movements
  WHERE movement_type = 'exit'
  ORDER BY equipment_id, created_at DESC, id DESC
)
UPDATE public.eq_equipments eq
SET last_exit_reason      = NULL,
    last_exit_description = NULL
WHERE (eq.last_exit_reason IS NOT NULL OR eq.last_exit_description IS NOT NULL)
  AND COALESCE(
        (SELECT movement_type FROM (
           SELECT DISTINCT ON (equipment_id) equipment_id, movement_type
           FROM public.eq_movements
           ORDER BY equipment_id, created_at DESC, id DESC
         ) lm WHERE lm.equipment_id = eq.id),
        'entry'
      ) <> 'exit';

WITH last_exit AS (
  SELECT DISTINCT ON (equipment_id) equipment_id, exit_reason, description
  FROM public.eq_movements
  WHERE movement_type = 'exit'
  ORDER BY equipment_id, created_at DESC, id DESC
)
UPDATE public.eq_equipments eq
SET last_exit_reason      = le.exit_reason,
    last_exit_description = le.description
FROM last_exit le
WHERE le.equipment_id = eq.id
  AND eq.location_status = 'outside'
  AND (eq.last_exit_reason IS DISTINCT FROM le.exit_reason
       OR eq.last_exit_description IS DISTINCT FROM le.description);

-- ----------------------------------------------------------------------------
-- 3. Trigger de sincronização: eq_movements -> eq_equipments
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eq_sync_equipment_location_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_equipment_id UUID;
  v_last_type    TEXT;
  v_reason       TEXT;
  v_description  TEXT;
  v_moved_at     TIMESTAMPTZ;
  v_target       TEXT;
BEGIN
  v_equipment_id := COALESCE(NEW.equipment_id, OLD.equipment_id);

  SELECT movement_type, exit_reason, description, created_at
    INTO v_last_type, v_reason, v_description, v_moved_at
  FROM public.eq_movements
  WHERE equipment_id = v_equipment_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_target := CASE WHEN v_last_type = 'exit' THEN 'outside' ELSE 'inside' END;

  -- Libera o guard de escrita direta: esta atualização É derivada de um
  -- registro de portaria, portanto é legítima.
  PERFORM set_config('eq.movement_sync', 'on', true);

  IF v_last_type IS NULL THEN
    -- Nenhum movimento: equipment fica DENTRO (nada registrou saída).
    UPDATE public.eq_equipments
    SET location_status       = 'inside',
        last_exit_reason      = NULL,
        last_exit_description = NULL,
        updated_at            = TIMEZONE('utc'::text, NOW())
    WHERE id = v_equipment_id
      AND (location_status IS DISTINCT FROM 'inside'
           OR last_exit_reason IS NOT NULL
           OR last_exit_description IS NOT NULL);
  ELSE
    UPDATE public.eq_equipments
    SET location_status       = v_target,
        last_exit_reason      = CASE WHEN v_target = 'outside' THEN v_reason       ELSE NULL END,
        last_exit_description = CASE WHEN v_target = 'outside' THEN v_description ELSE NULL END,
        updated_at            = COALESCE(v_moved_at, TIMEZONE('utc'::text, NOW()))
    WHERE id = v_equipment_id
      AND (location_status IS DISTINCT FROM v_target
           OR last_exit_reason IS DISTINCT FROM (CASE WHEN v_target = 'outside' THEN v_reason       ELSE NULL END)
           OR last_exit_description IS DISTINCT FROM (CASE WHEN v_target = 'outside' THEN v_description ELSE NULL END));
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS eq_sync_equipment_location_status_trg ON public.eq_movements;

CREATE TRIGGER eq_sync_equipment_location_status_trg
AFTER INSERT OR UPDATE OR DELETE ON public.eq_movements
FOR EACH ROW EXECUTE FUNCTION public.eq_sync_equipment_location_status();

-- ----------------------------------------------------------------------------
-- 4. Guard: proíbe escrever localização sem registro de portaria
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eq_guard_location_status_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atualizações que não tocam a localização (ex.: updated_at, status)
  -- passam livremente.
  IF NEW.location_status IS NOT DISTINCT FROM OLD.location_status THEN
    RETURN NEW;
  END IF;

  -- Atualização derivada de um movimento de portaria (via trigger ou RPC).
  IF current_setting('eq.movement_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Não é possível alterar a localização de "%" (código %) diretamente. Registre a movimentação em eq_movements para que a entrada/saída fique auditada. Use eq_register_movement().',
    COALESCE(OLD.name, OLD.plate_tag, OLD.id::text),
    COALESCE(OLD.plate_tag, 's/ placa')
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS eq_guard_location_status_write_trg ON public.eq_equipments;

CREATE TRIGGER eq_guard_location_status_write_trg
BEFORE UPDATE OF location_status ON public.eq_equipments
FOR EACH ROW EXECUTE FUNCTION public.eq_guard_location_status_write();

-- ----------------------------------------------------------------------------
-- 5. eq_register_movement: registra portaria de forma atômica
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eq_register_movement(
  p_equipment_id  UUID,
  p_movement_type TEXT,
  p_exit_reason   TEXT        DEFAULT NULL,
  p_description   TEXT        DEFAULT NULL,
  p_created_by    TEXT        DEFAULT NULL,
  p_created_at    TIMESTAMPTZ DEFAULT NULL,
  p_updated_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.eq_movements
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement public.eq_movements;
  v_ts       TIMESTAMPTZ;
BEGIN
  IF p_movement_type NOT IN ('entry', 'exit') THEN
    RAISE EXCEPTION 'movement_type inválido: %. Use "entry" ou "exit".', p_movement_type;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.eq_equipments WHERE id = p_equipment_id) THEN
    RAISE EXCEPTION 'Equipamento % não encontrado.', p_equipment_id;
  END IF;

  IF p_movement_type = 'exit' AND (p_exit_reason IS NULL OR btrim(p_exit_reason) = '') THEN
    RAISE EXCEPTION 'É obrigatório informar o motivo da saída.';
  END IF;

  v_ts := COALESCE(p_created_at, TIMEZONE('utc'::text, NOW()));

  INSERT INTO public.eq_movements (
    equipment_id, movement_type, exit_reason, description, created_by, created_at
  ) VALUES (
    p_equipment_id,
    p_movement_type,
    CASE WHEN p_movement_type = 'exit' THEN btrim(p_exit_reason) ELSE NULL END,
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    p_created_by,
    v_ts
  )
  RETURNING * INTO v_movement;

  -- O trigger de sincronização já atualizou o equipamento; o UPDATE abaixo é
  -- apenas idempotente e garante o carimbo de tempo informado pela UI.
  PERFORM set_config('eq.movement_sync', 'on', true);

  UPDATE public.eq_equipments
  SET updated_at = COALESCE(p_updated_at, v_ts)
  WHERE id = p_equipment_id;

  RETURN v_movement;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eq_register_movement(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated, service_role;