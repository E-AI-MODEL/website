-- Bestaande LEIF-proef uitbreiden zonder sessies of antwoorden te wijzigen.
alter table public.leif_demo_sessions
  add column if not exists tester_name text
  check (tester_name is null or char_length(tester_name) between 1 and 120);
