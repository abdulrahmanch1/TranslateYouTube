-- Wallet: balance per user + safe RPCs for top-up/charge

alter table public.profiles
  add column if not exists balance_cents integer not null default 0;

-- Top-up wallet by amount_cents (positive integer). Returns new balance.
drop function if exists public.wallet_topup(int);
create or replace function public.wallet_topup(amount_cents int)
returns int
language sql
security invoker -- RLS applies: user can update only own row
as $$
  update public.profiles
    set balance_cents = balance_cents + greatest(0, coalesce(amount_cents,0)),
        updated_at = now()
  where id = auth.uid()
  returning balance_cents;
$$;

-- Charge wallet by amount_cents if sufficient funds. Returns new balance, or NULL if insufficient.
drop function if exists public.wallet_charge(int);
create or replace function public.wallet_charge(amount_cents int)
returns int
language sql
security invoker
as $$
  update public.profiles
    set balance_cents = balance_cents - greatest(0, coalesce(amount_cents,0)),
        updated_at = now()
  where id = auth.uid()
    and balance_cents >= greatest(0, coalesce(amount_cents,0))
  returning balance_cents;
$$;

-- Allow anon/authenticated to call the RPCs via Supabase
grant execute on function public.wallet_topup(int) to anon, authenticated;
grant execute on function public.wallet_charge(int) to anon, authenticated;