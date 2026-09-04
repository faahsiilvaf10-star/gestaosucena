-- ==============================================================================
-- GESTÃO SUCENA - CHAT INTERNO (SUPABASE SQL SCRIPT)
-- Execute este script no painel do Supabase (SQL Editor)
-- ==============================================================================

-- 1. Tabela de Presença do Usuário
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e criar políticas para user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualquer usuário logado pode ver a presença" ON public.user_presence FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar sua própria presença" ON public.user_presence FOR ALL USING (auth.uid() = user_id);

-- 2. Tabela de Conversas
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) DEFAULT 'direct', -- 'direct' ou 'group'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_id UUID, -- Referência à tabela messages (adicionaremos a FK depois)
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de Participantes da Conversa
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_message_id UUID, -- Referência à tabela messages
    last_read_at TIMESTAMP WITH TIME ZONE,
    is_muted BOOLEAN DEFAULT false,
    cleared_at TIMESTAMP WITH TIME ZONE, -- Para a exclusão lógica "Apagar conversa"
    UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Políticas de Conversas e Participantes
CREATE POLICY "Usuários veem suas conversas" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Usuários podem criar conversas" ON public.conversations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem atualizar suas conversas" ON public.conversations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Usuários veem participantes de suas conversas" ON public.conversation_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Usuários podem se adicionar ou ser adicionados a conversas" ON public.conversation_participants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem atualizar seus próprios dados de participação" ON public.conversation_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. Tabela de Mensagens
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'video', 'audio', 'document'
    text TEXT,
    reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_for_everyone BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'sent' -- 'sent', 'delivered', 'read'
);

-- Atualiza as FKs circulares pendentes nas tabelas anteriores
ALTER TABLE public.conversations 
    ADD CONSTRAINT fk_last_message FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.conversation_participants 
    ADD CONSTRAINT fk_last_read_message FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem mensagens de suas conversas" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Participantes podem enviar mensagens" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
        )
        AND auth.uid() = sender_id
    );

CREATE POLICY "Usuários podem atualizar mensagens em suas conversas (ex: status lido/entregue)" ON public.messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants cp 
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
        )
    );

-- 5. Tabela de Anexos
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    type VARCHAR(20),
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT,
    mime_type VARCHAR(100),
    file_size INTEGER,
    duration INTEGER, -- Para áudio/vídeo em segundos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem anexos de suas conversas" ON public.message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE m.id = message_attachments.message_id AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Autores da mensagem podem adicionar anexos" ON public.message_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_id AND m.sender_id = auth.uid()
        )
    );

-- ==============================================================================
-- 6. CONFIGURAÇÃO DO REALTIME
-- ==============================================================================
-- Ativar Realtime para as tabelas essenciais (se a publicação supabase_realtime não existir, crie-a)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;


-- ==============================================================================
-- 7. STORAGE BUCKET (chat_media)
-- ==============================================================================
-- Você pode precisar rodar isso como superuser ou via painel web, mas tentaremos via SQL
INSERT INTO storage.buckets (id, name, public) VALUES ('chat_media', 'chat_media', true)
ON CONFLICT (id) DO NOTHING;

-- Política simples de leitura e escrita para o bucket
CREATE POLICY "Permitir leitura pública" ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Usuários autenticados podem inserir no chat_media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media' AND auth.role() = 'authenticated');
