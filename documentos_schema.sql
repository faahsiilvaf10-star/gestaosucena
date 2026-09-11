-- Criar bucket de storage para os documentos se não existir
insert into storage.buckets (id, name, public)
values ('documentos_cargos', 'documentos_cargos', true)
on conflict (id) do nothing;

-- Permitir leitura pública dos arquivos
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'documentos_cargos' );

-- Permitir insert para usuários autenticados
create policy "Auth Insert"
  on storage.objects for insert
  with check ( bucket_id = 'documentos_cargos' and auth.role() = 'authenticated' );

-- Permitir update/delete para usuários autenticados
create policy "Auth Update Delete"
  on storage.objects for update
  using ( bucket_id = 'documentos_cargos' and auth.role() = 'authenticated' );

create policy "Auth Delete"
  on storage.objects for delete
  using ( bucket_id = 'documentos_cargos' and auth.role() = 'authenticated' );

-- Criar tabela para os metadados dos arquivos
create table if not exists public.doc_arquivos (
    id uuid default gen_random_uuid() primary key,
    cargo_id text not null,
    file_name text not null,
    file_path text not null,
    file_size bigint not null,
    file_type text not null,
    uploaded_by uuid references auth.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Configurar RLS na tabela doc_arquivos
alter table public.doc_arquivos enable row level security;

-- Permitir leitura para todos os usuários autenticados
create policy "Permitir leitura de arquivos para autenticados"
  on public.doc_arquivos for select
  to authenticated
  using (true);

-- Permitir insert para todos os usuários autenticados
create policy "Permitir upload de arquivos para autenticados"
  on public.doc_arquivos for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

-- Permitir delete para todos os usuários autenticados
create policy "Permitir delete de arquivos para autenticados"
  on public.doc_arquivos for delete
  to authenticated
  using (true);
