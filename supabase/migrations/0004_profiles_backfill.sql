-- Backfill profiles for existing users and harden wallet invariants

-- Ensure every existing auth user has a profile row
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Ensure non-negative wallet balances at the DB level
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_balance_nonnegative'
  ) then
    alter table public.profiles
      add constraint profiles_balance_nonnegative
      check (balance_cents >= 0);
  end if;
end$$;

