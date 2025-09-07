alter table public.profiles
  add column if not exists display_name text,
  add column if not exists channel_url text,
  add column if not exists primary_lang text,
  add column if not exists target_langs text[],
  add column if not exists accepted_tos_at timestamptz;

-- Allow owner to insert their own profile row
drop policy if exists "Profiles insertable by owner" on public.profiles;
create policy "Profiles insertable by owner" on public.profiles
for insert with check ( auth.uid() = id );

