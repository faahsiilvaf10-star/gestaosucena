-- ==============================================================================
-- GESTÃO SUCENA - PAINEL ADMINISTRATIVO (SUPABASE SQL SCRIPT)
-- Execute este script no painel do Supabase (SQL Editor)
-- Para gerenciar usuários (bloquear, editar, deletar) via frontend.
-- ==============================================================================

-- 1. Função interna para validar se quem chama é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  u_role TEXT;
  u_name TEXT;
  u_email TEXT;
BEGIN
  SELECT raw_user_meta_data->>'role', raw_user_meta_data->>'full_name', email INTO u_role, u_name, u_email
  FROM auth.users WHERE id = user_id;
  
  -- Considera admin se a role contiver 'admin' ou 'diretor', ou o nome tiver 'fabricio', ou for o email exato
  IF (
    u_role ILIKE '%admin%' OR 
    u_role ILIKE '%diretor%' OR 
    u_name ILIKE '%fabricio%' OR 
    u_name ILIKE '%fabrício%' OR
    u_email = 'ffaahsiilva@gmail.com'
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Função para listar todos os usuários e seus status (Banned_until diz se está bloqueado)
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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Função para bloquear / desbloquear
CREATE OR REPLACE FUNCTION public.admin_toggle_block_user(target_user_id UUID, should_block BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: você não é um administrador.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode bloquear a si mesmo.';
  END IF;
  
  IF should_block THEN
    -- Bloqueia garantindo que a data seja muito no futuro
    UPDATE auth.users SET banned_until = NOW() + INTERVAL '100 years' WHERE id = target_user_id;
  ELSE
    -- Desbloqueia
    UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Função para excluir conta de usuário
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: você não é um administrador.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir a si mesmo. Solicite a outro administrador.';
  END IF;
  
  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Função para editar metadados do usuário (Nome e Cargo)
CREATE OR REPLACE FUNCTION public.admin_edit_user(target_user_id UUID, new_name TEXT, new_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: você não é um administrador.';
  END IF;
  
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) 
                           || jsonb_build_object('full_name', new_name, 'role', new_role)
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 6. Função para alterar a senha do usuário
CREATE OR REPLACE FUNCTION public.admin_change_user_password(target_user_id UUID, new_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: você não é um administrador.';
  END IF;

  -- Verifica se a senha tem pelo menos 6 caracteres
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;
  
  -- Atualiza a senha usando a função de criptografia do pgcrypto nativo do Supabase
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
