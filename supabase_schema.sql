-- Supabase schema per Dashboard Preferenze Lombardia
-- Eseguire nel SQL Editor del progetto Supabase.

create table if not exists public.correnti (
  candidato text primary key,
  corrente text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_groups (
  id text primary key,
  provincia text not null,
  candidato_1 text not null,
  candidato_2 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_two_distinct_candidates check (candidato_1 <> candidato_2)
);

create index if not exists ticket_groups_provincia_idx
  on public.ticket_groups (provincia);

alter table public.correnti enable row level security;
alter table public.ticket_groups enable row level security;

-- Le tabelle sono predisposte per l'accesso autenticato.
-- Non vengono create policy anonime: il database resta chiuso finché
-- non colleghiamo l'autenticazione del dashboard.

drop policy if exists "correnti_authenticated_select" on public.correnti;
create policy "correnti_authenticated_select"
  on public.correnti for select
  to authenticated
  using (true);

drop policy if exists "correnti_authenticated_insert" on public.correnti;
create policy "correnti_authenticated_insert"
  on public.correnti for insert
  to authenticated
  with check (true);

drop policy if exists "correnti_authenticated_update" on public.correnti;
create policy "correnti_authenticated_update"
  on public.correnti for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "correnti_authenticated_delete" on public.correnti;
create policy "correnti_authenticated_delete"
  on public.correnti for delete
  to authenticated
  using (true);

drop policy if exists "tickets_authenticated_select" on public.ticket_groups;
create policy "tickets_authenticated_select"
  on public.ticket_groups for select
  to authenticated
  using (true);

drop policy if exists "tickets_authenticated_insert" on public.ticket_groups;
create policy "tickets_authenticated_insert"
  on public.ticket_groups for insert
  to authenticated
  with check (true);

drop policy if exists "tickets_authenticated_update" on public.ticket_groups;
create policy "tickets_authenticated_update"
  on public.ticket_groups for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tickets_authenticated_delete" on public.ticket_groups;
create policy "tickets_authenticated_delete"
  on public.ticket_groups for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.correnti to authenticated;
grant select, insert, update, delete on public.ticket_groups to authenticated;

-- Accesso condiviso della dashboard pubblica.
-- Le modifiche sono volutamente condivise tra i visitatori del sito.
drop policy if exists "correnti_anon_select" on public.correnti;
create policy "correnti_anon_select" on public.correnti for select to anon using (true);

drop policy if exists "correnti_anon_insert" on public.correnti;
create policy "correnti_anon_insert" on public.correnti for insert to anon with check (true);

drop policy if exists "correnti_anon_update" on public.correnti;
create policy "correnti_anon_update" on public.correnti for update to anon using (true) with check (true);

drop policy if exists "correnti_anon_delete" on public.correnti;
create policy "correnti_anon_delete" on public.correnti for delete to anon using (true);

grant select, insert, update, delete on public.correnti to anon;

drop policy if exists "ticket_groups_anon_select" on public.ticket_groups;
create policy "ticket_groups_anon_select" on public.ticket_groups for select to anon using (true);

drop policy if exists "ticket_groups_anon_insert" on public.ticket_groups;
create policy "ticket_groups_anon_insert" on public.ticket_groups for insert to anon with check (true);

drop policy if exists "ticket_groups_anon_update" on public.ticket_groups;
create policy "ticket_groups_anon_update" on public.ticket_groups for update to anon using (true) with check (true);

drop policy if exists "ticket_groups_anon_delete" on public.ticket_groups;
create policy "ticket_groups_anon_delete" on public.ticket_groups for delete to anon using (true);

grant select, insert, update, delete on public.ticket_groups to anon;
