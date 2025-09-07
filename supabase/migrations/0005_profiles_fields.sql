-- Extra profile fields used by the app

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists accepted_tos_at timestamptz;

