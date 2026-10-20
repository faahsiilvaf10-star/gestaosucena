-- ====================================================================================
-- Função: Admin resetar senha do usuário (versão simplificada)
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
  user_role TEXT;
BEGIN
  -- Buscar o role do usuário atual
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Verificar se o usuário atual é admin ou diretor
  IF user_role IS NULL OR (
    user_role NOT ILIKE '%admin%' AND
    user_role NOT ILIKE '%diretor%'
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
DECLARE
  user_role TEXT;
BEGIN
  -- Buscar o role do usuário atual
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Verificar se o usuário atual é admin ou diretor
  IF user_role IS NULL OR (
    user_role NOT ILIKE '%admin%' AND
    user_role NOT ILIKE '%diretor%'
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

-- ====================================================================================
-- Função: Admin editar usuário
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_edit_user(
  target_user_id UUID,
  new_name TEXT,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Buscar o role do usuário atual
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Verificar se o usuário atual é admin ou diretor
  IF user_role IS NULL OR (
    user_role NOT ILIKE '%admin%' AND
    user_role NOT ILIKE '%diretor%'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar usuários';
  END IF;

  -- Atualizar nome
  IF new_name IS NOT NULL AND new_name <> '' THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{full_name}',
      to_jsonb(new_name)
    )
    WHERE id = target_user_id;
  END IF;

  -- Atualizar role
  IF new_role IS NOT NULL AND new_role <> '' THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{role}',
      to_jsonb(new_role)
    )
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- ====================================================================================
-- Função: Toggle bloquear usuário
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_toggle_block_user(
  target_user_id UUID,
  should_block BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Buscar o role do usuário atual
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Verificar se o usuário atual é admin ou diretor
  IF user_role IS NULL OR (
    user_role NOT ILIKE '%admin%' AND
    user_role NOT ILIKE '%diretor%'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem bloquear usuários';
  END IF;

  IF should_block THEN
    -- Bloquear permanentemente
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{banned_until}',
      to_jsonb('2099-12-31'::text)
    )
    WHERE id = target_user_id;
  ELSE
    -- Desbloquear
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{banned_until}',
      'null'::jsonb
    )
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- ====================================================================================
-- Função: Deletar usuário
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Buscar o role do usuário atual
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Verificar se o usuário atual é admin ou diretor
  IF user_role IS NULL OR (
    user_role NOT ILIKE '%admin%' AND
    user_role NOT ILIKE '%diretor%'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- ====================================================================================
-- Função: Listar usuários
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  banned_until TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as name,
    COALESCE(u.raw_user_meta_data->>'role', 'Usuário') as role,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    u.created_at,
    u.last_sign_in_at,
    u.raw_user_meta_data->>'banned_until' as banned_until
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- ====================================================================================
-- Função auxiliar para gerar string aleatória
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.gen_random_string(length INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ====================================================================================
-- Permissões
-- ====================================================================================

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user_with_reason TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_block_user_with_reason TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_user TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_edit_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_block_user TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_toggle_block_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_list_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_random_string TO postgres;
GRANT EXECUTE ON FUNCTION public.gen_random_string TO authenticated;
