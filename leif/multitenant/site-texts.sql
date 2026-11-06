-- LEIF site-teksten: apart van antwoorden en persoonlijke verhalen.
-- Alleen de Edge Function gebruikt deze tabellen. Zonder databasemigratie
-- blijven de ingebouwde teksten zichtbaar.
create table if not exists public.leif_site_texts (
 page text not null check (page in ('start','mijn','vervolg','verhaal','beheer')),
 field_key text not null check (field_key ~ '^[0-9a-f]{16}$'),
 original_text text not null check (char_length(original_text) between 3 and 6000),
 draft_text text not null check (char_length(draft_text) <= 6000),
 published_text text check (published_text is null or char_length(published_text) <= 6000),
 revision integer not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 changed_by uuid,
 primary key (page,field_key)
);
create table if not exists public.leif_site_text_history (
 id bigint generated always as identity primary key,
 page text not null,
 field_key text not null,
 revision integer not null,
 original_text text not null,
 draft_text text not null,
 published_text text,
 event text not null check (event in ('save','publish','unpublish','restore','create')),
 changed_by uuid,
 changed_at timestamptz not null default now()
);
create index if not exists leif_site_history_lookup
 on public.leif_site_text_history(page,field_key,id desc);
alter table public.leif_site_texts enable row level security;
alter table public.leif_site_text_history enable row level security;
revoke all on public.leif_site_texts from anon, authenticated;
revoke all on public.leif_site_text_history from anon, authenticated;
revoke all on sequence public.leif_site_text_history_id_seq from anon, authenticated;
-- Alleen een vastgestelde beheerder mag publiceren; de publieke Edge Function
-- geeft uitsluitend published_text terug.

create or replace function public.leif_site_text_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.leif_site_text_history(
 page,field_key,revision,original_text,draft_text,published_text,event,changed_by
 )values(
 new.page,new.field_key,new.revision,new.original_text,new.draft_text,new.published_text,
 case when tg_op='INSERT' then 'create'
      when old.published_text is distinct from new.published_text
       then case when new.published_text is null then 'unpublish' else 'publish' end
      else 'save' end,
 new.changed_by
 );
 return new;
end;
$$;
drop trigger if exists leif_site_text_history_trigger on public.leif_site_texts;
create trigger leif_site_text_history_trigger
after insert or update on public.leif_site_texts
for each row execute function public.leif_site_text_audit();
