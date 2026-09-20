-- Criação da tabela para Permissão de Trabalho (PT)
create table if not exists public.permissao_trabalho (
    id uuid default gen_random_uuid() primary key,
    titulo text not null,
    numero text not null,
    tipo text not null default 'PT (Permissão de Trabalho)',
    data_vencimento date not null,
    status text not null default 'Atualizado',
    arquivo_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger para atualizar o updated_at
create or replace function update_modified_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

drop trigger if exists update_permissao_trabalho_modtime on public.permissao_trabalho;
create trigger update_permissao_trabalho_modtime
    before update on public.permissao_trabalho
    for each row
    execute function update_modified_column();

-- Habilitar Row Level Security (RLS)
alter table public.permissao_trabalho enable row level security;

-- Políticas de acesso para permissao_trabalho
create policy "Permitir leitura para todos os autenticados"
    on public.permissao_trabalho for select
    to authenticated
    using (true);

create policy "Permitir inserção para autenticados"
    on public.permissao_trabalho for insert
    to authenticated
    with check (true);

create policy "Permitir atualização para autenticados"
    on public.permissao_trabalho for update
    to authenticated
    using (true);

create policy "Permitir deleção para autenticados"
    on public.permissao_trabalho for delete
    to authenticated
    using (true);

-- Criar bucket de storage para os anexos das PTs se não existir
insert into storage.buckets (id, name, public)
values ('permissao_trabalho_anexos', 'permissao_trabalho_anexos', true)
on conflict (id) do nothing;

-- Políticas de storage
DROP POLICY IF EXISTS "Public Access permissao_trabalho_anexos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert permissao_trabalho_anexos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Delete permissao_trabalho_anexos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete permissao_trabalho_anexos" ON storage.objects;

create policy "Public Access permissao_trabalho_anexos"
  on storage.objects for select
  using ( bucket_id = 'permissao_trabalho_anexos' );

create policy "Auth Insert permissao_trabalho_anexos"
  on storage.objects for insert
  with check ( bucket_id = 'permissao_trabalho_anexos' and auth.role() = 'authenticated' );

create policy "Auth Update Delete permissao_trabalho_anexos"
  on storage.objects for update
  using ( bucket_id = 'permissao_trabalho_anexos' and auth.role() = 'authenticated' );

create policy "Auth Delete permissao_trabalho_anexos"
  on storage.objects for delete
  using ( bucket_id = 'permissao_trabalho_anexos' and auth.role() = 'authenticated' );
