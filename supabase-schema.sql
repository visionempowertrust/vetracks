create table if not exists public.raahat_themes (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.raahat_people (
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
  person_name text not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, person_name)
);

create table if not exists public.raahat_actions (
  id uuid primary key,
  title text not null,
  priority text not null check (priority in ('Critical', 'High', 'Medium', 'Low')),
  status text not null check (status in ('Open', 'In progress', 'Blocked', 'Done')),
  due_date date not null,
  meeting_id uuid references public.raahat_meetings(id) on delete cascade,
  notes text,
  created_at date not null default current_date,
  completed_at date
);

create table if not exists public.raahat_action_people (
  action_id uuid not null references public.raahat_actions(id) on delete cascade,
  person_name text not null,
  created_at timestamptz not null default now(),
  primary key (action_id, person_name)
);

create table if not exists public.raahat_action_themes (
  action_id uuid not null references public.raahat_actions(id) on delete cascade,
  theme_name text not null,
  created_at timestamptz not null default now(),
  primary key (action_id, theme_name)
);

create table if not exists public.raahat_action_notes (
  id uuid primary key,
  action_id uuid not null references public.raahat_actions(id) on delete cascade,
  note text not null,
  person_name text not null,
  note_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.raahat_themes enable row level security;
alter table public.raahat_people enable row level security;
alter table public.raahat_meetings enable row level security;
alter table public.raahat_meeting_participants enable row level security;
alter table public.raahat_actions enable row level security;
alter table public.raahat_action_people enable row level security;
alter table public.raahat_action_themes enable row level security;
alter table public.raahat_action_notes enable row level security;

drop policy if exists "Allow public app access to themes" on public.raahat_themes;
drop policy if exists "Allow public app access to people" on public.raahat_people;
drop policy if exists "Allow public app access to meetings" on public.raahat_meetings;
drop policy if exists "Allow public app access to meeting participants" on public.raahat_meeting_participants;
drop policy if exists "Allow public app access to actions" on public.raahat_actions;
drop policy if exists "Allow public app access to action people" on public.raahat_action_people;
drop policy if exists "Allow public app access to action themes" on public.raahat_action_themes;
drop policy if exists "Allow public app access to action notes" on public.raahat_action_notes;

create policy "Allow public app access to themes"
on public.raahat_themes
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to people"
on public.raahat_people
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

create policy "Allow public app access to action people"
on public.raahat_action_people
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to action themes"
on public.raahat_action_themes
for all
to anon
using (true)
with check (true);

create policy "Allow public app access to action notes"
on public.raahat_action_notes
for all
to anon
using (true)
with check (true);
