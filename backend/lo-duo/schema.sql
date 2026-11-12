-- LO Aanvalslab: private, short-lived 4v4 game rooms, hosted by the existing Supabase project.
-- Table has NO anonymous/authenticated access; only the Edge Function's server-side
-- secret may read or change room state. No student names, accounts or addresses are stored.
create table if not exists public.lo_duo_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
 attack_hash text not null,
 defence_hash text,
 scenario integer not null default 0 check (scenario between 0 and 63),
 attack_plan jsonb,
 defence_plan jsonb,
 attack_ready boolean not null default false,
 defence_ready boolean not null default false,
 status text not null default 'waiting' check (status in ('waiting','planning','playing')),
 seed integer not null default 1337,
 start_at timestamptz,
 revision bigint not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '3 hours')
);
alter table public.lo_duo_rooms enable row level security;
revoke all on public.lo_duo_rooms from public, anon, authenticated;

create or replace function public.lo_duo_touch()
returns trigger language plpgsql security invoker
set search_path=public as $$
begin new.revision := old.revision+1;return new;end;$$;
revoke all on function public.lo_duo_touch() from public, anon, authenticated;
drop trigger if exists lo_duo_touch on public.lo_duo_rooms;
create trigger lo_duo_touch before update on public.lo_duo_rooms
for each row execute function public.lo_duo_touch();

-- Only a revision marker is broadcast. Neither team's plan is broadcast.
create or replace function public.lo_duo_notify()
returns trigger language plpgsql security definer
set search_path=public,realtime as $$
begin
 perform realtime.send(jsonb_build_object('revision',new.revision),
 'changed','lo-duo:'||new.id::text,false);
 return new;
end;$$;
revoke all on function public.lo_duo_notify() from public, anon, authenticated;
drop trigger if exists lo_duo_notify on public.lo_duo_rooms;
create trigger lo_duo_notify after update on public.lo_duo_rooms
for each row execute function public.lo_duo_notify();

-- If pg_cron is enabled in the project, schedule an hourly expiration cleanup:
-- select cron.schedule('lo-duo-expire', '17 * * * *',
-- $$delete from public.lo_duo_rooms where expires_at < now()$$);