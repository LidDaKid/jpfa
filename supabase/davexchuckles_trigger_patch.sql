-- JPFA shares the davexchuckles Supabase project. This makes the davexchuckles signup trigger
-- ignore JPFA accounts (fake emails @jpfa-agents.com) so they don't need an invite code or get a profile.
-- Original body = same thing without the first "if" line.
CREATE OR REPLACE FUNCTION private.handle_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uname text := lower(trim(new.raw_user_meta_data->>'username'));
  err text;
begin
  if new.email like '%@jpfa-agents.com' then return new; end if;
  err := public.check_signup(uname, new.raw_user_meta_data->>'invite');
  if err is not null then raise exception '%', err; end if;
  insert into public.profiles (id, username, name) values (new.id, uname, uname);
  return new;
end $function$;
