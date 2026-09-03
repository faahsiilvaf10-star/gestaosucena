-- ====================================================================================
-- M√ìDULO DE LEMBRETES - SCRIPT DE CRIA√á√ÉO DO BANCO DE DADOS (SUPABASE)
-- ====================================================================================
-- IMPORTANTE: Execute este script no SQL Editor do painel do Supabase.
-- Ele cria todas as tabelas necess√°rias, RLS (Row Level Security) e relacionamentos 
-- usando a tabela padr√£o auth.users do Supabase para garantir a seguran√ßa.

-- 1. EXTENS√ïES (se necess√°rio)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS public.reminder_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE TAGS
CREATE TABLE IF NOT EXISTS public.reminder_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA PRINCIPAL DE LEMBRETES
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em andamento', 'Conclu√≠do', 'Cancelado')),
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Baixa', 'Normal', 'Alta', 'Urgente')),
    category_id UUID REFERENCES public.reminder_categories(id) ON DELETE SET NULL,
    due_date DATE,
    due_time TIME,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_type TEXT,
    recurrence_config JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RELACIONAMENTO LEMBRETES <-> TAGS
CREATE TABLE IF NOT EXISTS public.reminder_tag_relations (
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.reminder_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (reminder_id, tag_id)
);

-- 6. MEN√á√ïES NOS LEMBRETES
CREATE TABLE IF NOT EXISTS public.reminder_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mentioned_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. COMENT√ÅRIOS
CREATE TABLE IF NOT EXISTS public.reminder_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. MEN√á√ïES NOS COMENT√ÅRIOS
CREATE TABLE IF NOT EXISTS public.reminder_comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID REFERENCES public.reminder_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. SUBTAREFAS
CREATE TABLE IF NOT EXISTS public.reminder_subtasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date DATE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. FAVORITOS
CREATE TABLE IF NOT EXISTS public.reminder_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, reminder_id)
);

-- 11. ANEXOS
CREATE TABLE IF NOT EXISTS public.reminder_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. NOTIFICA√á√ïES
CREATE TABLE IF NOT EXISTS public.reminder_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ====================================================================================
-- CONFIGURA√á√ïES DE SEGURAN√áA (ROW LEVEL SECURITY - RLS)
-- ====================================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_notifications ENABLE ROW LEVEL SECURITY;

-- Pol√≠ticas de acesso (Exemplo gen√©rico: Todos os usu√°rios autenticados podem ver e editar os lembretes do tenant/sistema)
-- NOTA: Se voc√™ tiver regras estritas (ex: usu√°rio s√≥ v√™ os pr√≥prios lembretes), ajuste aqui.
CREATE POLICY "Autenticados podem ler lembretes" ON public.reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir lembretes" ON public.reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Autenticados podem atualizar lembretes" ON public.reminders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir lembretes" ON public.reminders FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "Autenticados podem ler tudo" ON public.reminder_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir categorias" ON public.reminder_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler tags" ON public.reminder_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir tags" ON public.reminder_tags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem gerenciar rela√ß√µes" ON public.reminder_tag_relations FOR ALL TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler subtarefas" ON public.reminder_subtasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem gerenciar subtarefas" ON public.reminder_subtasks FOR ALL TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler comentarios" ON public.reminder_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir comentarios" ON public.reminder_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Autenticados podem alterar proprios comentarios" ON public.reminder_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Autenticados podem excluir proprios comentarios" ON public.reminder_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Autenticados podem ler notificacoes" ON public.reminder_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Autenticados podem atualizar notificacoes" ON public.reminder_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Sistema pode inserir notificacoes" ON public.reminder_notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler favoritos" ON public.reminder_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Autenticados podem gerenciar favoritos" ON public.reminder_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Storage (Voc√™ precisar√° criar o bucket manualmente no painel)
-- insert into storage.buckets (id, name, public) values ('reminder_attachments', 'reminder_attachments', true);

-- Realtime
-- Adicione as tabelas ao Realtime para o frontend reagir a mudan√ßas instantaneamente
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminder_notifications;

 - -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
 - -   O B T E N « √ O   S E G U R A   D E   U S U ¡ R I O S 
 - -   C o m o   n „ o   h ·   u m a   t a b e l a   p ˙ b l i c a   d e   p r o f i l e s ,   c r i a m o s   u m a   f u n Á „ o   R P C   ( R e m o t e   P r o c e d u r e   C a l l ) 
 - -   q u e   l Í   c o m   s e g u r a n Á a   o s   d a d o s   b · s i c o s   ( I D ,   N o m e ,   A v a t a r ,   E m a i l )   d e   a u t h . u s e r s   
 - -   p a r a   p o d e r m o s   l i s t a r   o s   r e s p o n s · v e i s   e   m e n Á ı e s   n o   f r o n t e n d . 
 - -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . g e t _ u s e r s ( ) 
 R E T U R N S   T A B L E   ( 
         i d   U U I D , 
         e m a i l   V A R C H A R , 
         n a m e   T E X T , 
         a v a t a r _ u r l   T E X T 
 )   
 L A N G U A G E   s q l 
 S E C U R I T Y   D E F I N E R 
 A S   \ $ \ $ 
         S E L E C T   
                 i d ,   
                 e m a i l : : V A R C H A R ,   
                 r a w _ u s e r _ m e t a _ d a t a - > > ' f u l l _ n a m e '   A S   n a m e ,   
                 r a w _ u s e r _ m e t a _ d a t a - > > ' a v a t a r _ u r l '   A S   a v a t a r _ u r l   
         F R O M   a u t h . u s e r s ; 
 \ $ \ $ ; 
 
 - -   P e r m i t e   q u e   u s u · r i o s   a u t e n t i c a d o s   e x e c u t e m   a   f u n Á „ o 
 G R A N T   E X E C U T E   O N   F U N C T I O N   p u b l i c . g e t _ u s e r s ( )   T O   a u t h e n t i c a t e d ; 
  
 