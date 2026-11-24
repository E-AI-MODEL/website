-- EAI Insights: geaggregeerde dagtotalen, zonder personen- of sessietabel.
create table if not exists public.eai_site_daily_counts (
  day date not null default ((now() at time zone 'UTC')::date),
  path text not null,
  event text not null,
  device text not null,
  count bigint not null default 0,
  primary key(day,path,event,device),
  constraint eai_counts_path check(length(path) between 1 and 120 and path like '/%'),
  constraint eai_counts_event check(event in ('pagina','tool','gelezen')),
  constraint eai_counts_device check(device in ('mobiel','desktop')),
  constraint eai_counts_positive check(count >= 0)
);
alter table public.eai_site_daily_counts enable row level security;
revoke all on public.eai_site_daily_counts from anon,authenticated;

create or replace function public.eai_site_increment(p_path text,p_event text,p_device text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_path is null or length(p_path)>120
    or p_path !~ '^/[a-zA-Z0-9/_\.-]*$'
    or p_path ~ '^/(leif|houseoftalents|admin)(/|$)'
    or p_event not in ('pagina','tool','gelezen')
    or p_device not in ('mobiel','desktop')
  then raise exception 'Invalid aggregate event'; end if;
  insert into public.eai_site_daily_counts(day,path,event,device,count)
  values ((now() at time zone 'UTC')::date,p_path,p_event,p_device,1)
  on conflict(day,path,event,device) do update
  set count=public.eai_site_daily_counts.count+1;
end $$;
revoke all on function public.eai_site_increment(text,text,text) from public,anon,authenticated;
grant execute on function public.eai_site_increment(text,text,text) to service_role;

create or replace function public.eai_site_read(p_days integer default 30)
returns table(day date,path text,event text,device text,count bigint)
language sql security definer set search_path = ''
as $$
  select s.day,s.path,s.event,s.device,s.count
  from public.eai_site_daily_counts s
  where s.day >= ((now() at time zone 'UTC')::date -
      (least(greatest(coalesce(p_days,30),1),90)-1))
  order by s.day asc,s.path asc limit 50000;
$$;
revoke all on function public.eai_site_read(integer) from public,anon,authenticated;
grant execute on function public.eai_site_read(integer) to service_role;