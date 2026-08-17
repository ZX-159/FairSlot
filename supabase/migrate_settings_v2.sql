-- Optional columns for newer settings (safe to re-run)
alter table public.event_settings add column if not exists allow_notes boolean default true;
alter table public.event_settings add column if not exists show_location_link boolean default true;
