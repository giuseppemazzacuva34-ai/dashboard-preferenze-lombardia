-- Supabase schema per Dashboard Preferenze Lombardia
-- Schema pubblico in sola lettura; scrittura riservata agli amministratori autenticati.

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

create table if not exists public.dashboard_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.correnti enable row level security;
alter table public.ticket_groups enable row level security;
alter table public.dashboard_admins enable row level security;

-- Privilegi minimi: anon può solo leggere i dati pubblici.
revoke all on table public.correnti from anon, authenticated;
revoke all on table public.ticket_groups from anon, authenticated;
revoke all on table public.dashboard_admins from anon, authenticated;

grant select on table public.correnti, public.ticket_groups to anon;
grant select, insert, update, delete on table public.correnti, public.ticket_groups to authenticated;
grant select on table public.dashboard_admins to authenticated;
grant all on table public.correnti, public.ticket_groups, public.dashboard_admins to service_role;

-- Correnti
drop policy if exists "correnti_anon_select" on public.correnti;
create policy "correnti_anon_select"
  on public.correnti for select
  to anon
  using (true);

drop policy if exists "correnti_authenticated_select" on public.correnti;
create policy "correnti_authenticated_select"
  on public.correnti for select
  to authenticated
  using (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "correnti_authenticated_insert" on public.correnti;
create policy "correnti_authenticated_insert"
  on public.correnti for insert
  to authenticated
  with check (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "correnti_authenticated_update" on public.correnti;
create policy "correnti_authenticated_update"
  on public.correnti for update
  to authenticated
  using (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "correnti_authenticated_delete" on public.correnti;
create policy "correnti_authenticated_delete"
  on public.correnti for delete
  to authenticated
  using (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

-- Ticket
drop policy if exists "ticket_groups_anon_select" on public.ticket_groups;
drop policy if exists "tickets_anon_select" on public.ticket_groups;
create policy "ticket_groups_anon_select"
  on public.ticket_groups for select
  to anon
  using (true);

drop policy if exists "ticket_groups_authenticated_select" on public.ticket_groups;
create policy "ticket_groups_authenticated_select"
  on public.ticket_groups for select
  to authenticated
  using (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "ticket_groups_authenticated_insert" on public.ticket_groups;
create policy "ticket_groups_authenticated_insert"
  on public.ticket_groups for insert
  to authenticated
  with check (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "ticket_groups_authenticated_update" on public.ticket_groups;
create policy "ticket_groups_authenticated_update"
  on public.ticket_groups for update
  to authenticated
  using (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

drop policy if exists "ticket_groups_authenticated_delete" on public.ticket_groups;
create policy "ticket_groups_authenticated_delete"
  on public.ticket_groups for delete
  to authenticated
  using (exists (
    select 1 from public.dashboard_admins a
    where a.user_id = (select auth.uid())
  ));

-- Tabella amministratori: ogni amministratore autenticato può verificare solo la propria presenza.
drop policy if exists "dashboard_admins_self_select" on public.dashboard_admins;
create policy "dashboard_admins_self_select"
  on public.dashboard_admins for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Le vecchie RPC di persistenza non sono più utilizzate dal frontend.
alter function public.dashboard_get_state() security invoker;
alter function public.dashboard_save_state(jsonb) security invoker;
revoke execute on function public.dashboard_get_state() from public, anon, authenticated;
revoke execute on function public.dashboard_save_state(jsonb) from public, anon, authenticated;
grant execute on function public.dashboard_get_state() to service_role;
grant execute on function public.dashboard_save_state(jsonb) to service_role;
