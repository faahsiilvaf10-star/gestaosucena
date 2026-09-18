create table if not exists public.residuos_registros (
  id uuid not null default gen_random_uuid(),
  data_registro text not null, -- formato: 'YYYY-MM'
  papel_kg numeric default 0,
  plastico_kg numeric default 0,
  nao_reciclavel_kg numeric default 0,
  metal_kg numeric default 0,
  organico_kg numeric default 0,
  setor text default 'GERAL'::text,
  created_at timestamp with time zone not null default now(),
  constraint residuos_registros_pkey primary key (id),
  constraint residuos_registros_data_registro_key unique (data_registro)
);

-- RLS policies
alter table public.residuos_registros enable row level security;

drop policy if exists "Enable read access for all users" on public.residuos_registros;
create policy "Enable read access for all users"
on public.residuos_registros
as PERMISSIVE
for SELECT
to public
using (true);

drop policy if exists "Enable insert/update for all users" on public.residuos_registros;
create policy "Enable insert/update for all users"
on public.residuos_registros
as PERMISSIVE
for ALL
to public
using (true)
with check (true);

-------------------------------------------------------------------------------
-- EFLUENTES
-------------------------------------------------------------------------------

create table if not exists public.efluentes_registros (
  id uuid not null default gen_random_uuid(),
  data_registro text not null, -- formato: 'YYYY-MM'
  volume_m3 numeric default 0,
  setor text default 'GERAL'::text,
  created_at timestamp with time zone not null default now(),
  constraint efluentes_registros_pkey primary key (id),
  constraint efluentes_registros_data_registro_key unique (data_registro)
);

-- RLS policies
alter table public.efluentes_registros enable row level security;

drop policy if exists "Enable read access for all users" on public.efluentes_registros;
create policy "Enable read access for all users"
on public.efluentes_registros
as PERMISSIVE
for SELECT
to public
using (true);

drop policy if exists "Enable insert/update for all users" on public.efluentes_registros;
create policy "Enable insert/update for all users"
on public.efluentes_registros
as PERMISSIVE
for ALL
to public
using (true)
with check (true);
