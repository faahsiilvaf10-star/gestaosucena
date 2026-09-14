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
