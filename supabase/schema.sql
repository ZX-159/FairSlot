-- =============================================================================
-- FairSlot — run this once in YOUR Supabase project
-- Dashboard → SQL Editor → New query → paste → Run
--
-- Security model:
--   • Browser uses the anon key for Auth + Realtime only.
--   • All writes (and any sensitive reads) go through /api with the
--     service_role key, which bypasses RLS.
--   • RLS therefore describes what the browser / anon key may see:
--       - events & slots: public SELECT (live inventory + realtime)
--       - claims: organisers may SELECT rows for events they own (studio realtime)
--       - event_settings: NO direct access (join_pin must never hit the client)
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
  capacity integer not null default 1 check (capacity >= 1),
  claimed_count integer not null default 0 check (claimed_count >= 0),
  sort_order integer default 0,
  locked boolean default false,
  created_at timestamptz default timezone('utc', now()),
  constraint slots_claimed_lte_capacity check (claimed_count <= capacity)
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
  ticket_note text default '',
  allow_notes boolean default true,
  show_location_link boolean default true
);

create index if not exists events_creator_id_idx on public.events (creator_id);
create index if not exists events_join_code_idx on public.events (join_code);
create index if not exists events_status_idx on public.events (status);
create index if not exists slots_event_id_idx on public.slots (event_id);
create index if not exists claims_event_id_idx on public.claims (event_id);
create index if not exists claims_slot_id_idx on public.claims (slot_id);
create index if not exists claims_token_idx on public.claims (claim_token);
create index if not exists claims_email_event_idx on public.claims (event_id, participant_email);

-- Realtime DELETE payloads need full row images
alter table public.events replica identity full;
alter table public.slots replica identity full;
alter table public.claims replica identity full;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.slots enable row level security;
alter table public.claims enable row level security;
alter table public.event_settings enable row level security;

-- Drop every prior policy name this project has used so re-runs are safe.
drop policy if exists public_read_events on public.events;
drop policy if exists public_read_slots on public.slots;
drop policy if exists public_read_claims on public.claims;
drop policy if exists public_read_event_settings on public.event_settings;
drop policy if exists events_select on public.events;
drop policy if exists slots_select on public.slots;
drop policy if exists claims_select_own_events on public.claims;
drop policy if exists event_settings_select_own on public.event_settings;

-- events: public directory + claim page + realtime status/lock updates.
-- (Writes still only via service_role /api.)
create policy events_select on public.events
  for select
  to anon, authenticated
  using (true);

-- slots: live inventory on the claim page (realtime claimed_count).
create policy slots_select on public.slots
  for select
  to anon, authenticated
  using (true);

-- claims: NEVER world-readable (emails / phones).
-- Organisers signed in with the anon key may read claims for events they own
-- so studio realtime can poke a refresh. Participants only ever see their own
-- receipt through /api/public?token=… (service_role).
create policy claims_select_own_events on public.claims
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = claims.event_id
        and e.creator_id = auth.uid()::text
    )
  );

-- event_settings: no direct client access at all.
-- join_pin, notices, windows are served (and stripped) by /api only.
-- (Intentionally no SELECT policy — default deny under RLS.)

-- No INSERT/UPDATE/DELETE policies for anon/authenticated on any table.
-- service_role bypasses RLS and is the only writer.

-- -----------------------------------------------------------------------------
-- Grants (Supabase defaults are usually fine; be explicit for fresh projects)
-- -----------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;

grant select on table public.events to anon, authenticated;
grant select on table public.slots to anon, authenticated;
grant select on table public.claims to authenticated;
-- event_settings: no grant to anon/authenticated

grant all on table public.events to service_role;
grant all on table public.slots to service_role;
grant all on table public.claims to service_role;
grant all on table public.event_settings to service_role;

grant usage, select on all sequences in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Realtime publication (live inventory)
-- -----------------------------------------------------------------------------
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
    -- Studio listens for new claims; RLS still filters rows per organiser.
    alter publication supabase_realtime add table public.claims;
  exception when duplicate_object then null;
  end;
end $$;

-- -----------------------------------------------------------------------------
-- pgcrypto provides gen_random_bytes (claim tokens)
create extension if not exists pgcrypto with schema extensions;
-- Fall back if extensions schema isn't used on this project
do $$ begin
  create extension if not exists pgcrypto;
exception when others then null;
end $$;

-- Atomic claim helper (optional; /api/claims also does optimistic locking)
-- Runs as invoker is irrelevant — only called with service_role from /api.
-- -----------------------------------------------------------------------------
create or replace function public.claim_slot(
  p_slot_id integer,
  p_participant_name text,
  p_participant_email text,
  p_participant_phone text default '',
  p_notes text default '',
  p_claim_token text default null
)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.slots%rowtype;
  v_event public.events%rowtype;
  v_token text;
  v_claim public.claims%rowtype;
begin
  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_slot.locked then
    raise exception 'SLOT_LOCKED' using errcode = 'P0001';
  end if;
  if v_slot.claimed_count >= v_slot.capacity then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where id = v_slot.event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_event.locked then
    raise exception 'EVENT_LOCKED' using errcode = 'P0001';
  end if;
  if v_event.status is distinct from 'live' then
    raise exception 'EVENT_NOT_LIVE' using errcode = 'P0001';
  end if;

  update public.slots
     set claimed_count = claimed_count + 1
   where id = v_slot.id
     and claimed_count < capacity
     and locked = false;

  if not found then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  v_token := nullif(trim(p_claim_token), '');
  if v_token is null or v_token = '' then
    begin
      v_token := encode(gen_random_bytes(9), 'hex');
    exception when undefined_function then
      v_token := substr(md5(random()::text || clock_timestamp()::text), 1, 18);
    end;
  end if;

  insert into public.claims (
    slot_id, event_id, participant_name, participant_email,
    participant_phone, notes, claim_token
  ) values (
    v_slot.id, v_event.id,
    left(trim(p_participant_name), 80),
    lower(trim(p_participant_email)),
    left(coalesce(p_participant_phone, ''), 40),
    left(coalesce(p_notes, ''), 500),
    v_token
  )
  returning * into v_claim;

  return v_claim;
exception
  when unique_violation then
    -- roll claimed_count back if token collided (extremely rare)
    update public.slots set claimed_count = greatest(claimed_count - 1, 0) where id = p_slot_id;
    raise;
end;
$$;

revoke all on function public.claim_slot(integer, text, text, text, text, text) from public;
grant execute on function public.claim_slot(integer, text, text, text, text, text) to service_role;
