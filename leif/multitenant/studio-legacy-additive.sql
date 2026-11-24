-- LEIF Studio: persoonlijke onderdelen voor bestaande proefregistraties.
-- Alleen toevoegen: bestaande antwoorden en toegangscodes blijven ongewijzigd.
alter table public.leif_demo_sessions
  add column if not exists personal_texts jsonb not null default '{}'::jsonb
  check (jsonb_typeof(personal_texts) = 'object');

alter table public.leif_demo_sessions
  add column if not exists studio_revision integer not null default 0
  check (studio_revision >= 0);

-- De browser mag niet rechtstreeks bij persoonlijke gegevens.
alter table public.leif_demo_sessions enable row level security;
revoke all on public.leif_demo_sessions from anon, authenticated;
