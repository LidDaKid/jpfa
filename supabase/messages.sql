-- JPFA messaging: HQ channel (to_id null) + DMs between approved agents.
create table if not exists jpfa_messages (
  id bigserial primary key,
  from_id uuid references jpfa_agents on delete cascade,
  to_id uuid references jpfa_agents on delete cascade,
  body text not null,
  t timestamptz not null default now(),
  read boolean not null default false
);
create index if not exists jpfa_messages_t on jpfa_messages (t desc);
alter table jpfa_messages enable row level security;
drop policy if exists jpfa_messages_read on jpfa_messages;
create policy jpfa_messages_read on jpfa_messages for select
  using ((to_id is null and jpfa_my_rank()>=0) or from_id=auth.uid() or to_id=auth.uid());

create or replace function jpfa_send_message(p_to uuid, p_body text) returns void
language plpgsql security definer set search_path=public as $$
declare b text := trim(coalesce(p_body,'')); cs text;
begin
  if jpfa_my_rank()<0 then raise exception 'agents only'; end if;
  if b='' or length(b)>1000 then raise exception 'Message must be 1-1000 characters'; end if;
  if p_to is not null then
    select callsign into cs from jpfa_agents where id=p_to and status='approved';
    if cs is null then raise exception 'Unknown agent'; end if;
    if p_to=auth.uid() then raise exception 'Cannot message yourself'; end if;
  end if;
  insert into jpfa_messages(from_id,to_id,body) values (auth.uid(),p_to,b);
  perform jpfa_log_as(auth.uid(),'message',case when p_to is null then 'Posted in HQ chat' else 'Messaged '||cs end);
end $$;

create or replace function jpfa_mark_read(p_other uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update jpfa_messages set read=true where to_id=auth.uid() and from_id=p_other and not read;
end $$;
