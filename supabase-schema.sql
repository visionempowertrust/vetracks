create table if not exists public.raahat_themes (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.raahat_owners (
  id uuid primary key,
  name text not null unique,
  role text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.raahat_meetings (
  id uuid primary key,
  title text not null,
  date date not null,
  theme_name text not null,
  mom text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.raahat_meeting_participants (
  meeting_id uuid not null references public.raahat_meetings(id) on delete cascade,
  owner_name text not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, owner_name)
);

create table if not exists public.raahat_actions (
  id uuid primary key,
  title text not null,
  owner_name text not null,
  theme_name text not null,
  priority text not null check (priority in ('Critical', 'High', 'Medium', 'Low')),
  status text not null check (status in ('Open', 'In progress', 'Blocked', 'Done')),
  due_date date not null,
  meeting_id uuid references public.raahat_meetings(id) on delete cascade,
  notes text,
  created_at date not null default current_date,
  completed_at date
);

alter table public.raahat_themes enable row level security;
alter table public.raahat_owners enable row level security;
alter table public.raahat_meetings enable row level security;
alter table public.raahat_meeting_participants enable row level security;
alter table public.raahat_actions enable row level security;

drop policy if exists "Allow public app access to themes" on public.raahat_themes;
drop policy if exists "Allow public app access to owners" on public.raahat_owners;
drop policy if exists "Allow public app access to meetings" on public.raahat_meetings;
drop policy if exists "Allow public app access to meeting participants" on public.raahat_meeting_participants;
drop policy if exists "Allow public app access to actions" on public.raahat_actions;

create policy "Allow public app access to themes"
on public.raahat_themes
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to owners"
on public.raahat_owners
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to meetings"
on public.raahat_meetings
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to meeting participants"
on public.raahat_meeting_participants
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to actions"
on public.raahat_actions
for all
to anon
using (true)
with check (true);
