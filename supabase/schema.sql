-- =============================================================================
-- FairSlot — run this once in YOUR Supabase project
-- Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================

create table if not exists public.events (
  id serial primary key,
  creator_id text not null,
  title text not null,
  description text default '',
  location text default '',
  event_date timestamptz,
  cover_url text default '',
  category text default 'General',
  status text default 'draft',
  join_code text not null unique,
  locked boolean default false,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.slots (
  id serial primary key,
  event_id integer not null references public.events(id) on delete cascade,
  name text not null,
  description text default '',
  category text default 'General',
  capacity integer default 1,
  claimed_count integer default 0,
  sort_order integer default 0,
  locked boolean default false,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.claims (
  id serial primary key,
  slot_id integer not null references public.slots(id) on delete cascade,
  event_id integer not null references public.events(id) on delete cascade,
  participant_name text not null,
  participant_email text not null,
  participant_phone text default '',
  notes text default '',
  claim_token text not null unique,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.event_settings (
  event_id integer primary key references public.events(id) on delete cascade,
  join_pin text default '',
  require_phone boolean default false,
  one_per_email boolean default false,
  confirm_email boolean default false,
  hide_remaining boolean default false,
  unlisted boolean default false,
  require_notice_ack boolean default false,
  claim_opens_at timestamptz,
  claim_closes_at timestamptz,
  notice_title text default '',
  notice_body text default '',
  success_title text default '',
  success_message text default '',
  ticket_note text default ''
);

create index if not exists events_creator_id_idx on public.events (creator_id);
create index if not exists events_join_code_idx on public.events (join_code);
create index if not exists events_status_idx on public.events (status);
create index if not exists slots_event_id_idx on public.slots (event_id);
create index if not exists claims_event_id_idx on public.claims (event_id);
create index if not exists claims_slot_id_idx on public.claims (slot_id);
create index if not exists claims_token_idx on public.claims (claim_token);
create index if not exists claims_email_event_idx on public.claims (event_id, participant_email);

alter table public.events enable row level security;
alter table public.slots enable row level security;
alter table public.claims enable row level security;
alter table public.event_settings enable row level security;

drop policy if exists public_read_events on public.events;
drop policy if exists public_read_slots on public.slots;
drop policy if exists public_read_claims on public.claims;
drop policy if exists public_read_event_settings on public.event_settings;

-- Anon key is used by the browser for auth + realtime only.
-- All writes go through /api with the service role, which bypasses RLS.
create policy public_read_events on public.events for select using (true);
create policy public_read_slots on public.slots for select using (true);
create policy public_read_claims on public.claims for select using (true);
create policy public_read_event_settings on public.event_settings for select using (true);

-- Live inventory on the claim page and studio
do $$
begin
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.slots;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.claims;
  exception when duplicate_object then null;
  end;
end $$;
