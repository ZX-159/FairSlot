-- =============================================================================
-- FairSlot — upgrade an EXISTING project that already ran an older schema.sql
-- Safe to re-run. Does not drop data.
-- =============================================================================

-- Capacity integrity
do $$ begin
  alter table public.slots
    add constraint slots_claimed_lte_capacity check (claimed_count <= capacity);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.slots
    add constraint slots_capacity_positive check (capacity >= 1);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.slots
    add constraint slots_claimed_nonneg check (claimed_count >= 0);
exception when duplicate_object then null;
end $$;

alter table public.events replica identity full;
alter table public.slots replica identity full;
alter table public.claims replica identity full;

-- Replace overly-permissive public SELECT on claims / settings
drop policy if exists public_read_events on public.events;
drop policy if exists public_read_slots on public.slots;
drop policy if exists public_read_claims on public.claims;
drop policy if exists public_read_event_settings on public.event_settings;
drop policy if exists events_select on public.events;
drop policy if exists slots_select on public.slots;
drop policy if exists claims_select_own_events on public.claims;
drop policy if exists event_settings_select_own on public.event_settings;

alter table public.events enable row level security;
alter table public.slots enable row level security;
alter table public.claims enable row level security;
alter table public.event_settings enable row level security;

create policy events_select on public.events
  for select to anon, authenticated using (true);

create policy slots_select on public.slots
  for select to anon, authenticated using (true);

create policy claims_select_own_events on public.claims
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = claims.event_id and e.creator_id = auth.uid()::text
    )
  );

-- event_settings: intentionally no client policies (join_pin stays server-side)

-- Tighten grants (Supabase often grants broad defaults)
revoke all on table public.event_settings from anon, authenticated;
revoke all on table public.claims from anon;
grant select on table public.events to anon, authenticated;
grant select on table public.slots to anon, authenticated;
grant select on table public.claims to authenticated;
grant all on table public.events to service_role;
grant all on table public.slots to service_role;
grant all on table public.claims to service_role;
grant all on table public.event_settings to service_role;

-- Realtime
do $$
begin
  begin alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.slots;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.claims;
  exception when duplicate_object then null; end;
end $$;

-- pgcrypto provides gen_random_bytes (claim tokens)
create extension if not exists pgcrypto with schema extensions;
-- Fall back if extensions schema isn't used on this project
do $$ begin
  create extension if not exists pgcrypto;
exception when others then null;
end $$;

-- Atomic claim helper
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
    update public.slots set claimed_count = greatest(claimed_count - 1, 0) where id = p_slot_id;
    raise;
end;
$$;

revoke all on function public.claim_slot(integer, text, text, text, text, text) from public;
grant execute on function public.claim_slot(integer, text, text, text, text, text) to service_role;


-- v2 settings columns
alter table public.event_settings add column if not exists allow_notes boolean default true;
alter table public.event_settings add column if not exists show_location_link boolean default true;
