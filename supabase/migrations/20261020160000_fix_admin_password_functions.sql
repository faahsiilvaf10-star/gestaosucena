-- ====================================================================================
-- Migração: Correção completa das funções administrativas e reset/alteração de senha
-- ====================================================================================

-- Habilitar pgcrypto para uso de crypt e gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Função interna e universal para validar se quem chama é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  u_role TEXT;
  u_name TEXT;
  u_email TEXT;
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT 
    COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role', ''),
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
    COALESCE(email, '')
  INTO u_role, u_name, u_email
  FROM auth.users 
  WHERE id = user_id;
  
  -- Considera admin se a role contiver 'admin' ou 'diretor' (exceto administrativo/administracao),
  -- ou se o nome contiver 'fabricio', ou for o email cadastrado do administrador
  IF (
    (
      (u_role ILIKE '%admin%' OR u_role ILIKE '%diretor%')
      AND u_role NOT ILIKE '%administrativo%'
      AND u_role NOT ILIKE '%administracao%'
      AND u_role NOT ILIKE '%administração%'
    ) OR 
    u_name ILIKE '%fabricio%' OR 
    u_name ILIKE '%fabrício%' OR
    u_email ILIKE '%ffaahsiilva%' OR
    u_email ILIKE '%fabricio%'
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alias de compatibilidade
CREATE OR REPLACE FUNCTION public._is_caller_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.is_admin(auth.uid());
END;
$$;

-- 2. Função: Admin resetar senha do usuário (Gera senha temporária funcional)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  temp_password TEXT;
BEGIN
  -- Validar se o chamador é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar senhas';
  END IF;

  -- Gerar senha temporária segura (ex: Sucena@5928)
  temp_password := 'Sucena@' || floor(1000 + random() * 9000)::text;

  -- Atualizar a senha criptografada diretamente no auth.users para login imediato
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(temp_password, extensions.gen_salt('bf')),
    raw_user_meta_data = jsonb_set(
      jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{password_reset_required}',
        'true'::jsonb
      ),
      '{temp_password}',
      to_jsonb(temp_password)
    ),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN temp_password;
END;
$$;

-- 3. Função: Admin alterar senha para uma nova senha digitada
CREATE OR REPLACE FUNCTION public.admin_change_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Validar se o chamador é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar senhas';
  END IF;

  -- Validar comprimento mínimo da senha
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Atualizar a senha usando criptografia nativa do Supabase (pgcrypto)
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{password_reset_required}',
      'false'::jsonb
    ),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- 4. Função: Bloquear / Desbloquear usuário
CREATE OR REPLACE FUNCTION public.admin_toggle_block_user(
  target_user_id UUID,
  should_block BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem bloquear usuários';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode bloquear a si mesmo';
  END IF;

  IF should_block THEN
    UPDATE auth.users 
    SET 
      banned_until = NOW() + INTERVAL '100 years',
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{banned_until}',
        to_jsonb((NOW() + INTERVAL '100 years')::text)
      )
    WHERE id = target_user_id;
  ELSE
    UPDATE auth.users 
    SET 
      banned_until = NULL,
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{banned_until}',
        'null'::jsonb
      )
    WHERE id = target_user_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 5. Função: Bloquear usuário com motivo e duração
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
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem bloquear usuários';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode bloquear a si mesmo';
  END IF;

  UPDATE auth.users
  SET 
    banned_until = blocked_until,
    raw_user_meta_data = jsonb_set(
      jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{banned_until}',
        to_jsonb(blocked_until::text)
      ),
      '{block_reason}',
      to_jsonb(COALESCE(block_reason, 'Bloqueio administrativo'))
    )
  WHERE id = target_user_id;
END;
$$;

-- 6. Função: Admin editar nome e cargo
CREATE OR REPLACE FUNCTION public.admin_edit_user(
  target_user_id UUID,
  new_name TEXT,
  new_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar usuários';
  END IF;

  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) 
                           || jsonb_build_object('full_name', new_name, 'role', new_role)
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- 7. Função: Excluir usuário
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir a sua própria conta';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN TRUE;
END;
$$;

-- 8. Função: Listar usuários
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  name TEXT,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  banned_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários.';
  END IF;

  RETURN QUERY
  SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', au.email)::TEXT as name, 
    COALESCE(au.raw_user_meta_data->>'role', 'Usuário')::TEXT as role, 
    (au.raw_user_meta_data->>'avatar_url')::TEXT as avatar_url,
    au.created_at,
    au.last_sign_in_at,
    au.banned_until
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

-- ====================================================================================
-- Permissões (GRANTs)
-- ====================================================================================

GRANT EXECUTE ON FUNCTION public.is_admin TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public._is_caller_admin TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_password TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_block_user TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user_with_reason TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_user TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users TO postgres, authenticated;
