-- Aanvulling op schema.sql. Concepten zijn nooit zichtbaar voor deelnemers.
create table if not exists public.leif_story_drafts (
 participant_id uuid not null references public.leif_participants(id) on delete cascade,
 part text not null check(part in ('deel_1','deel_2','deel_3')),
 content text not null default '' check(length(content)<=80000),
 version integer not null default 0 check(version>=0),
 updated_at timestamptz not null default now(),
 primary key(participant_id,part)
);
create table if not exists public.leif_story_draft_history (
 id bigint generated always as identity primary key,
 participant_id uuid not null references public.leif_participants(id) on delete cascade,
 part text not null,
 version integer not null,
 content text not null,
 changed_at timestamptz not null default now(),
 unique(participant_id,part,version)
);
create or replace function public.leif_audit_draft()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.version<>old.version+1 then
  raise exception 'Draft version conflict';
 end if;
 insert into public.leif_story_draft_history(participant_id,part,version,content)
 values(new.participant_id,new.part,new.version,new.content);
 return new;
end;
$$;
drop trigger if exists leif_story_audit on public.leif_story_drafts;
create trigger leif_story_audit after insert or update on public.leif_story_drafts
for each row execute function public.leif_audit_draft();
alter table public.leif_story_drafts enable row level security;
alter table public.leif_story_draft_history enable row level security;
revoke all on public.leif_story_drafts from anon,authenticated;
revoke all on public.leif_story_draft_history from anon,authenticated;
revoke all on function public.leif_audit_draft() from public,anon,authenticated;
