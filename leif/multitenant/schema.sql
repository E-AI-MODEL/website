-- LEIF persoonlijke omgevingen. Additief: bestaande leif_demo_sessions blijft ongewijzigd.
-- Eerst testen in een aparte database. Uitvoeren in productie vereist expliciete vrijgave.
create table if not exists public.leif_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.leif_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.leif_tenants(id) on delete restrict,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  access_hash text not null unique check (access_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'active' check (state in ('active','revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists leif_participants_tenant_idx on public.leif_participants(tenant_id);

create table if not exists public.leif_documents (
  participant_id uuid primary key references public.leif_participants(id) on delete cascade,
  questionnaire_version text not null default 'leif-2026-11-v1',
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  exercises jsonb not null default '{}'::jsonb check (jsonb_typeof(exercises) = 'object'),
  report jsonb not null default '{}'::jsonb check (jsonb_typeof(report) = 'object'),
  position jsonb not null default '{}'::jsonb check (jsonb_typeof(position) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leif_document_history (
  id bigint generated always as identity primary key,
  participant_id uuid not null references public.leif_participants(id) on delete cascade,
  revision integer not null check (revision >= 0),
  snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  unique(participant_id, revision)
);

create or replace function public.leif_document_audit()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.revision <> old.revision + 1 then
    raise exception 'LEIF revision must advance by one';
  end if;
  insert into public.leif_document_history(participant_id,revision,snapshot)
  values (new.participant_id, new.revision,
          jsonb_build_object('answers',new.answers,'exercises',new.exercises,
                             'report',new.report,'position',new.position,
                             'questionnaire_version',new.questionnaire_version));
  return new;
end;
$$;

drop trigger if exists leif_audit_document on public.leif_documents;
create trigger leif_audit_document after insert or update on public.leif_documents
for each row execute function public.leif_document_audit();

create or replace function public.leif_initialize_document()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  insert into public.leif_documents(participant_id) values(new.id);
  return new;
end;
$$;
drop trigger if exists leif_create_document on public.leif_participants;
create trigger leif_create_document after insert on public.leif_participants
for each row execute function public.leif_initialize_document();

-- Alleen Edge Functions met een servergeheim mogen lezen en schrijven.
alter table public.leif_tenants enable row level security;
alter table public.leif_participants enable row level security;
alter table public.leif_documents enable row level security;
alter table public.leif_document_history enable row level security;
revoke all on public.leif_tenants from anon, authenticated;
revoke all on public.leif_participants from anon, authenticated;
revoke all on public.leif_documents from anon, authenticated;
revoke all on public.leif_document_history from anon, authenticated;
revoke all on function public.leif_document_audit() from public, anon, authenticated;
revoke all on function public.leif_initialize_document() from public, anon, authenticated;
-- Bewust geen publieke RLS-policies. Ook een ingelogde Supabase-gebruiker
-- krijgt geen rechtstreeks recht op LEIF-dossiers.
