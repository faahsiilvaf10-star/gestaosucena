-- Instacena Migration 1: Base Tables & RLS

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  website text,
  is_private boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Posts (Includes Reels)
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_type text DEFAULT 'post', -- 'post' or 'reel'
  caption text,
  location text,
  visibility text DEFAULT 'public',
  comments_enabled boolean DEFAULT true,
  likes_hidden boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone
);

-- 3. Post Media
CREATE TABLE IF NOT EXISTS public.social_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  media_type text NOT NULL, -- 'image' or 'video'
  media_url text NOT NULL,
  thumbnail_url text,
  width integer,
  height integer,
  duration double precision,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. Likes
CREATE TABLE IF NOT EXISTS public.social_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(post_id, user_id)
);

-- 5. Comments
CREATE TABLE IF NOT EXISTS public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone
);

-- 6. Follows
CREATE TABLE IF NOT EXISTS public.social_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'accepted', -- 'pending' or 'accepted'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(follower_id, following_id)
);

-- 7. Stories
CREATE TABLE IF NOT EXISTS public.social_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_type text NOT NULL,
  media_url text NOT NULL,
  caption text,
  expires_at timestamp with time zone NOT NULL,
  archived boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 8. Story Views
CREATE TABLE IF NOT EXISTS public.social_story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.social_stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(story_id, user_id)
);

-- 9. Notifications
CREATE TABLE IF NOT EXISTS public.social_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- 'like', 'comment', 'follow', 'mention'
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  story_id uuid REFERENCES public.social_stories(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 10. Saved Posts
CREATE TABLE IF NOT EXISTS public.social_saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, post_id)
);

-- 11. Blocks
CREATE TABLE IF NOT EXISTS public.social_user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(blocker_id, blocked_id)
);

-- 12. Reports
CREATE TABLE IF NOT EXISTS public.social_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Read All, Write Own)
CREATE POLICY "Public profiles are viewable by everyone" ON public.social_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.social_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.social_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Posts are viewable by everyone" ON public.social_posts FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Users can insert own posts" ON public.social_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.social_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.social_posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Post media viewable by everyone" ON public.social_post_media FOR SELECT USING (true);
CREATE POLICY "Users can insert media for own posts" ON public.social_post_media FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.social_posts WHERE id = post_id AND user_id = auth.uid()));

CREATE POLICY "Likes viewable by everyone" ON public.social_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.social_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.social_post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments viewable by everyone" ON public.social_comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Users can insert own comments" ON public.social_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.social_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Follows viewable by everyone" ON public.social_follows FOR SELECT USING (true);
CREATE POLICY "Users can insert own follows" ON public.social_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete own follows" ON public.social_follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Stories viewable by everyone" ON public.social_stories FOR SELECT USING (deleted_at IS NULL AND archived = false);
CREATE POLICY "Users can insert own stories" ON public.social_stories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view views on their own stories" ON public.social_story_views FOR SELECT USING (EXISTS (SELECT 1 FROM public.social_stories WHERE id = story_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert their own view" ON public.social_story_views FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.social_notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own notifications" ON public.social_notifications FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "Users can view own saved posts" ON public.social_saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.social_saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.social_saved_posts FOR DELETE USING (auth.uid() = user_id);

-- Trigger to create social_profile automatically on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_social_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.social_profiles (user_id, username, display_name)
  VALUES (
    new.id,
    'user_' || substr(new.id::text, 1, 8), -- Generates a random initial username
    coalesce(new.raw_user_meta_data->>'name', 'Usuário')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists so we can safely re-run
DROP TRIGGER IF EXISTS on_auth_user_created_social ON auth.users;
CREATE TRIGGER on_auth_user_created_social
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_social_profile();
