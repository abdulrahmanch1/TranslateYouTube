create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text default 'none' not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='Profiles are viewable by owner'
  ) then
    create policy "Profiles are viewable by owner" on public.profiles
      for select using ( auth.uid() = id );
  end if;
end$$;

-- Allow user to update their own profile (limited — production may restrict columns)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='Profiles updatable by owner'
  ) then
    create policy "Profiles updatable by owner" on public.profiles
      for update using ( auth.uid() = id );
  end if;
end$$;