-- Ensure users created before Instacena also have a profile for their posts.
INSERT INTO public.social_profiles (user_id, username, display_name, avatar_url)
SELECT
  au.id,
  'user_' || replace(au.id::text, '-', '')::text,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1),
    'Usuário'
  ),
  COALESCE(au.raw_user_meta_data->>'avatar_url', '')
FROM auth.users AS au
WHERE NOT EXISTS (
  SELECT 1
  FROM public.social_profiles AS sp
  WHERE sp.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Keep the profile synchronized when a user's display metadata changes.
CREATE OR REPLACE FUNCTION public.sync_social_profile_from_auth()
RETURNS trigger AS $$
BEGIN
  UPDATE public.social_profiles
  SET
    display_name = COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      display_name
    ),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url),
    updated_at = now()
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated_social ON auth.users;
CREATE TRIGGER on_auth_user_updated_social
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_social_profile_from_auth();