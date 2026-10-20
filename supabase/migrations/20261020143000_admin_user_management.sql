-- ====================================================================================
-- Função: Bloquear usuário com motivo e duração
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_block_user_with_reason(
  target_user_id UUID,
  blocked_until TIMESTAMPTZ,
  block_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role' ILIKE '%admin%'
         OR raw_user_meta_data->>'role' ILIKE '%diretor%')
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem bloquear usuários';
  END IF;

  -- Atualizar banned_until na tabela de metadados do usuário
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'),
    '{banned_until}',
    to_jsonb(blocked_until::text)
  )
  WHERE id = target_user_id;

  -- Se forneceu um motivo, salvar também
  IF block_reason IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{block_reason}',
      to_jsonb(block_reason)
    )
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.admin_block_user_with_reason TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_block_user_with_reason TO authenticated;

-- ====================================================================================
-- Função: Admin editar cargo do usuário
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_edit_user_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role' ILIKE '%admin%'
         OR raw_user_meta_data->>'role' ILIKE '%diretor%')
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar usuários';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'),
    '{role}',
    to_jsonb(new_role)
  )
  WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_edit_user_role TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_edit_user_role TO authenticated;

-- ====================================================================================
-- Função: Admin resetar senha do usuário
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp_password TEXT;
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role' ILIKE '%admin%'
         OR raw_user_meta_data->>'role' ILIKE '%diretor%')
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar senhas';
  END IF;

  -- Gerar senha temporária
  temp_password := gen_random_string(12);

  -- Atualizar meta para forçar redefinição de senha no próximo login
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{password_reset_required}',
      'true'::jsonb
    ),
    '{temp_password}',
    to_jsonb(temp_password)
  )
  WHERE id = target_user_id;

  RETURN temp_password;
END;
$$;

-- Função auxiliar para gerar string aleatória
CREATE OR REPLACE FUNCTION public.gen_random_string(length INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_random_string TO postgres;
GRANT EXECUTE ON FUNCTION public.gen_random_string TO authenticated;

-- ====================================================================================
-- Verificação: Listar usuários com status de bloqueio
-- ====================================================================================
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name' as nome,
  raw_user_meta_data->>'role' as cargo,
  raw_user_meta_data->>'banned_until' as bloqueado_ate,
  raw_user_meta_data->>'block_reason' as motivo_bloqueio,
  created_at
FROM auth.users
ORDER BY created_at DESC;
