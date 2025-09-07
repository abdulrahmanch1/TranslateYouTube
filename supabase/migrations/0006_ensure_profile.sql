-- Ensure a profile row exists for the current authenticated user

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_profile() to anon, authenticated;

