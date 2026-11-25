-- JPFA schema (lives in the davexchuckles Supabase project, everything prefixed jpfa_). All writes go through security-definer RPCs; tables are read-only to clients via RLS.

create table if not exists jpfa_agents (
  id uuid primary key references auth.users on delete cascade,
  callsign text not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  appointed int not null default 0,
  aura int not null default 0,
  badge text not null,
  photo text,
  applied timestamptz not null default now(),
  joined timestamptz,
  last_duty date,
  last_seen timestamptz,
  exam_score int
);
create unique index if not exists agents_callsign_uq on jpfa_agents (lower(callsign)) where status <> 'denied';

create table if not exists jpfa_applications (
  agent_id uuid primary key references jpfa_agents on delete cascade,
  full_name text, contact text, sector text,
  o0 text, o1 text, o2 text,
  sig text
);

create table if not exists jpfa_exam_attempts (
  id bigserial primary key,
  agent_id uuid references jpfa_agents on delete cascade,
  t timestamptz not null default now(),
  answers int[] not null,
  score int not null,
  passed boolean not null
);

create table if not exists jpfa_sightings (
  id bigserial primary key,
  by uuid references jpfa_agents on delete set null,
  place text not null,
  kind text not null,
  t timestamptz not null,
  conf int not null,
  descr text,
  status text not null default 'pending',
  created timestamptz not null default now()
);

create table if not exists jpfa_activity (
  id bigserial primary key,
  agent_id uuid references jpfa_agents on delete cascade,
  t timestamptz not null default now(),
  kind text not null,
  text text not null
);
create index if not exists activity_t on jpfa_activity (t desc);

create table if not exists jpfa_config (key text primary key, value text);
create sequence if not exists jpfa_badge_seq start 1007 increment 7;

alter table jpfa_agents enable row level security;
alter table jpfa_applications enable row level security;
alter table jpfa_exam_attempts enable row level security;
alter table jpfa_sightings enable row level security;
alter table jpfa_activity enable row level security;
alter table jpfa_config enable row level security;

-- helpers
create or replace function jpfa_rank_of(p_aura int, p_appointed int) returns int language sql immutable as $$
  select greatest(p_appointed, case when p_aura>=800 then 5 when p_aura>=500 then 4 when p_aura>=300 then 3
    when p_aura>=150 then 2 when p_aura>=50 then 1 else 0 end) $$;

create or replace function jpfa_my_rank() returns int language sql stable security definer set search_path=public as $$
  select coalesce((select jpfa_rank_of(a.aura,a.appointed) from jpfa_agents a where a.id=auth.uid() and a.status='approved'),-1) $$;

create or replace function jpfa_is_director() returns boolean language sql stable security definer set search_path=public as $$
  select jpfa_my_rank()=6 $$;

create or replace function jpfa_rank_name(r int) returns text language sql immutable as $$
  select (array['Recruit','Field Agent','Special Agent','Senior Special Agent','Supervisory Agent','Deputy Director','Director'])[r+1] $$;

create or replace function jpfa_log_as(p_agent uuid, p_kind text, p_text text) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into jpfa_activity(agent_id,kind,text) values (p_agent,p_kind,left(p_text,300));
  update jpfa_agents set last_seen=now() where id=p_agent;
end $$;

create or replace function jpfa_grant_aura(p_agent uuid, n int) returns void language plpgsql security definer set search_path=public as $$
declare before int; after int;
begin
  select jpfa_rank_of(aura,appointed) into before from jpfa_agents where id=p_agent;
  update jpfa_agents set aura=aura+n where id=p_agent;
  select jpfa_rank_of(aura,appointed) into after from jpfa_agents where id=p_agent;
  if after>before then perform jpfa_log_as(p_agent,'rank','Promoted to '||jpfa_rank_name(after)); end if;
end $$;

-- policies (read only)
drop policy if exists agents_read on jpfa_agents;
create policy agents_read on jpfa_agents for select using (status='approved' or id=auth.uid() or jpfa_is_director());
drop policy if exists apps_read on jpfa_applications;
create policy apps_read on jpfa_applications for select using (agent_id=auth.uid() or jpfa_is_director());
drop policy if exists exam_read on jpfa_exam_attempts;
create policy exam_read on jpfa_exam_attempts for select using (agent_id=auth.uid() or jpfa_is_director());
drop policy if exists sightings_read on jpfa_sightings;
create policy sightings_read on jpfa_sightings for select using (true);
drop policy if exists activity_read on jpfa_activity;
create policy activity_read on jpfa_activity for select using (jpfa_is_director());
drop policy if exists config_read on jpfa_config;
create policy config_read on jpfa_config for select using (jpfa_my_rank()>=5);

-- RPCs
create or replace function jpfa_callsign_taken(cs text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from jpfa_agents where lower(callsign)=lower(trim(cs)) and status<>'denied') $$;

create or replace function jpfa_login_email(cs text) returns text language sql stable security definer set search_path=public as $$
  select u.email from jpfa_agents a join auth.users u on u.id=a.id where lower(a.callsign)=lower(trim(cs))
  order by (a.status='denied') limit 1 $$;

create or replace function jpfa_submit_application(cs text, p_name text, p_contact text, p_sector text, p0 text, p1 text, p2 text, p_sig text)
returns text language plpgsql security definer set search_path=public as $$
declare first boolean; st text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(auth.jwt()->>'email','') not like '%@jpfa-agents.com' then raise exception 'not a JPFA account'; end if;
  if exists(select 1 from jpfa_agents where id=auth.uid()) then raise exception 'already applied'; end if;
  if cs !~ '^[A-Za-z0-9_ .-]{2,20}$' then raise exception 'bad call sign'; end if;
  if jpfa_callsign_taken(cs) then raise exception 'Call sign taken'; end if;
  if length(p_sig)>400000 then raise exception 'signature too big'; end if;
  first := not exists(select 1 from jpfa_agents where status='approved');
  st := case when first then 'approved' else 'pending' end;
  insert into jpfa_agents(id,callsign,status,appointed,badge,joined)
    values (auth.uid(),trim(cs),st,case when first then 6 else 0 end,'JPFA-'||nextval('jpfa_badge_seq'),case when first then now() end);
  insert into jpfa_applications values (auth.uid(),left(p_name,60),left(p_contact,60),left(p_sector,60),p0,p1,p2,p_sig);
  perform jpfa_log_as(auth.uid(),'apply','Submitted application');
  if first then perform jpfa_log_as(auth.uid(),'rank','Became Director'); end if;
  return st;
end $$;

create or replace function jpfa_log_event(p_kind text, p_text text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from jpfa_agents where id=auth.uid()) then return; end if;
  if p_kind not in ('login','logout','view','badge') then raise exception 'bad kind'; end if;
  perform jpfa_log_as(auth.uid(),p_kind,p_text);
end $$;

create or replace function jpfa_file_sighting(p_place text, p_kind text, p_t timestamptz, p_conf int, p_descr text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if jpfa_my_rank()<0 then raise exception 'agents only'; end if;
  insert into jpfa_sightings(by,place,kind,t,conf,descr) values (auth.uid(),left(trim(p_place),80),p_kind,p_t,least(5,greatest(1,p_conf)),left(p_descr,600));
  perform jpfa_log_as(auth.uid(),'sighting','Filed sighting: '||left(trim(p_place),80));
  perform jpfa_grant_aura(auth.uid(),25);
end $$;

create or replace function jpfa_judge_sighting(p_id bigint, p_status text) returns void language plpgsql security definer set search_path=public as $$
declare s jpfa_sightings;
begin
  if jpfa_my_rank()<5 then raise exception 'Deputy Director+ only'; end if;
  if p_status not in ('confirmed','debunked') then raise exception 'bad status'; end if;
  select * into s from jpfa_sightings where id=p_id and status='pending';
  if not found then return; end if;
  update jpfa_sightings set status=p_status where id=p_id;
  perform jpfa_log_as(auth.uid(),'sighting','Marked "'||s.place||'" '||p_status);
  if p_status='confirmed' and s.by is not null then
    perform jpfa_log_as(s.by,'sighting','Sighting "'||s.place||'" was confirmed');
    perform jpfa_grant_aura(s.by,50);
  end if;
end $$;

create or replace function jpfa_decide(p_agent uuid, p_status text) returns void language plpgsql security definer set search_path=public as $$
declare cs text;
begin
  if not jpfa_is_director() then raise exception 'Director only'; end if;
  if p_status not in ('approved','denied') then raise exception 'bad status'; end if;
  update jpfa_agents set status=p_status, joined=case when p_status='approved' then now() else joined end where id=p_agent returning callsign into cs;
  perform jpfa_log_as(p_agent,'review','Application '||p_status);
end $$;

create or replace function jpfa_appoint(p_agent uuid, p_rank int) returns void language plpgsql security definer set search_path=public as $$
begin
  if not jpfa_is_director() then raise exception 'Director only'; end if;
  if p_agent=auth.uid() then raise exception 'cannot change own rank'; end if;
  update jpfa_agents set appointed=least(6,greatest(0,p_rank)) where id=p_agent;
  perform jpfa_log_as(p_agent,'rank','Appointed '||case when p_rank=0 then 'no rank (earned rank only)' else jpfa_rank_name(p_rank) end);
end $$;

create or replace function jpfa_submit_exam(p_answers int[]) returns int language plpgsql security definer set search_path=public as $$
declare key int[] := array[2,1,2,2,1]; s int := 0; i int;
begin
  if jpfa_my_rank()<0 then raise exception 'agents only'; end if;
  if exists(select 1 from jpfa_agents where id=auth.uid() and exam_score is not null) then raise exception 'already passed'; end if;
  for i in 1..5 loop if p_answers[i]=key[i] then s:=s+1; end if; end loop;
  insert into jpfa_exam_attempts(agent_id,answers,score,passed) values (auth.uid(),p_answers,s,s>=4);
  perform jpfa_log_as(auth.uid(),'exam','Field exam '||s||'/5 '||case when s>=4 then '(passed)' else '(failed)' end);
  if s>=4 then update jpfa_agents set exam_score=s where id=auth.uid(); perform jpfa_grant_aura(auth.uid(),100); end if;
  return s;
end $$;

create or replace function jpfa_report_duty() returns void language plpgsql security definer set search_path=public as $$
begin
  if jpfa_my_rank()<0 then raise exception 'agents only'; end if;
  if exists(select 1 from jpfa_agents where id=auth.uid() and last_duty=current_date) then return; end if;
  update jpfa_agents set last_duty=current_date where id=auth.uid();
  perform jpfa_log_as(auth.uid(),'duty','Reported for duty');
  perform jpfa_grant_aura(auth.uid(),10);
end $$;

create or replace function jpfa_set_callsign(cs text) returns void language plpgsql security definer set search_path=public as $$
declare old text;
begin
  if jpfa_my_rank()<0 then raise exception 'agents only'; end if;
  if cs !~ '^[A-Za-z0-9_ .-]{2,20}$' then raise exception 'Invalid call sign'; end if;
  if exists(select 1 from jpfa_agents where lower(callsign)=lower(trim(cs)) and status<>'denied' and id<>auth.uid()) then raise exception 'Call sign taken'; end if;
  select callsign into old from jpfa_agents where id=auth.uid();
  update jpfa_agents set callsign=trim(cs) where id=auth.uid();
  perform jpfa_log_as(auth.uid(),'profile','Changed call sign from '||old||' to '||trim(cs));
end $$;

create or replace function jpfa_set_photo(p text) returns void language plpgsql security definer set search_path=public as $$
begin
  if jpfa_my_rank()<0 then raise exception 'agents only'; end if;
  if length(p)>300000 or p not like 'data:image/%' then raise exception 'bad photo'; end if;
  update jpfa_agents set photo=p where id=auth.uid();
  perform jpfa_log_as(auth.uid(),'profile','Changed badge photo');
end $$;

create or replace function jpfa_set_notes(p text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not jpfa_is_director() then raise exception 'Director only'; end if;
  insert into jpfa_config values ('notes',left(p,1000)) on conflict (key) do update set value=excluded.value;
end $$;

revoke all on function jpfa_log_as(uuid,text,text) from public, anon, authenticated;
revoke all on function jpfa_grant_aura(uuid,int) from public, anon, authenticated;
