create table public.session_connections (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  from_name   text not null,
  to_name     text not null,
  kind        text not null check (kind in ('midi', 'sync', 'audio')),
  label       text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.session_connections enable row level security;

create policy "Users read own connections"
  on public.session_connections for select
  using (
    exists (select 1 from public.sessions s
            where s.id = session_id and s.user_id = auth.uid())
  );

create policy "Users write own connections"
  on public.session_connections for insert
  with check (
    exists (select 1 from public.sessions s
            where s.id = session_id and s.user_id = auth.uid())
  );

create policy "Users update own connections"
  on public.session_connections for update
  using (
    exists (select 1 from public.sessions s
            where s.id = session_id and s.user_id = auth.uid())
  );

create policy "Users delete own connections"
  on public.session_connections for delete
  using (
    exists (select 1 from public.sessions s
            where s.id = session_id and s.user_id = auth.uid())
  );
