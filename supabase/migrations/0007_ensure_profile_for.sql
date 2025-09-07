-- Admin helper to ensure a profile row for a specific user id

create or replace function public.ensure_profile_for(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (uid)
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_profile_for(uuid) to service_role, authenticated, anon;

