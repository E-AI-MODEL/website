-- LIS is een uitsluitend voor de proef bestemde, korte toegangscode.
-- Geen bestaande codes, deelnemers of dossiers worden gewijzigd.
alter table public.leif_participants add column if not exists test_alias text;
alter table public.leif_participants add column if not exists is_demo boolean not null default false;
create unique index if not exists leif_participants_test_alias_unique
  on public.leif_participants(test_alias) where test_alias is not null;
