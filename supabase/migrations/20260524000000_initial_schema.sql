-- 1. Extend auth.users with a minimal profile
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Devices
create type device_type as enum (
  'pocket_operator', 'analog_synth', 'digital_synth',
  'drum_machine', 'sampler', 'effects_unit', 'other'
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type device_type not null,
  manufacturer text,
  notes text,
  created_at timestamptz default now()
);
alter table public.devices enable row level security;
create policy "Own devices" on public.devices
  for all using (auth.uid() = user_id);
create index on public.devices(user_id);

-- 3. Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  bpm integer check (bpm > 0 and bpm < 400),
  key_scale text,
  mood_tags text[] default '{}',
  notes text,
  ableton_project text,
  forked_from uuid references public.sessions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.sessions enable row level security;
create policy "Own sessions" on public.sessions
  for all using (auth.uid() = user_id);
create index on public.sessions(user_id);
create index on public.sessions(created_at desc);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function update_updated_at();

-- 4. Session devices
create type sync_role as enum ('master', 'slave', 'standalone');

create table public.session_devices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  sync_role sync_role not null default 'standalone',
  sync_mode text,
  patch_notes text,
  sort_order integer not null default 0
);
alter table public.session_devices enable row level security;
create policy "Own session_devices" on public.session_devices
  for all using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
create index on public.session_devices(session_id);
