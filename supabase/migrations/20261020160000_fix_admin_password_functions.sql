-- ====================================================================================
-- Migração: Correção das funções de reset/alteração de senha no Admin
-- Problema: admin_change_user_password não existia; admin_reset_user_password
--           falhava quando o role do caller não estava em raw_user_meta_data.
-- Solução: Criar admin_change_user_password e tornar a verificação de role
--          mais robusta, consultando tanto raw_user_meta_data quanto app_metadata.
-- ====================================================================================

-- Helper interno: verifica se o usuário atual é admin ou diretor
CREATE OR REPLACE FUNCTION public._is_caller_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Tenta raw_user_meta_data primeiro (cadastro via app)
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Fallback para app_metadata (provisionamento manual no Supabase Dashboard)
  IF user_role IS NULL OR user_role = '' THEN
    SELECT app_metadata->>'role' INTO user_role
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  RETURN (
    user_role IS NOT NULL AND (
      user_role ILIKE '%admin%' OR
      user_role ILIKE '%diretor%'
    ) AND
    user_role NOT ILIKE '%administrativo%' AND
    user_role NOT ILIKE '%administracao%' AND
    user_role NOT ILIKE '%administração%'
  );
END;
$$;

-- ====================================================================================
-- Função: Admin resetar senha do usuário (gera senha aleatória temporária)
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
  -- Verificar se o usuário atual é admin ou diretor
  IF NOT public._is_caller_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar senhas';
  END IF;

  -- Gerar senha temporária
  temp_password := public.gen_random_string(12);

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
-- Função: Admin alterar senha específica de um usuário
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.admin_change_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário atual é admin ou diretor
  IF NOT public._is_caller_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar senhas de outros usuários';
  END IF;

  -- Validar comprimento mínimo da senha
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Atualizar a senha usando criptografia nativa do Supabase (pgcrypto)
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- ====================================================================================
-- Permissões
-- ====================================================================================

GRANT EXECUTE ON FUNCTION public._is_caller_admin TO postgres;
GRANT EXECUTE ON FUNCTION public._is_caller_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_password TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_change_user_password TO authenticated;
