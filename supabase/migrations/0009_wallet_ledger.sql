-- Ledger-first wallet RPCs and policies

-- RLS for wallet_transactions: allow owner to select only
alter table public.wallet_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wallet_transactions' and policyname='Wallet tx viewable by owner'
  ) then
    create policy "Wallet tx viewable by owner" on public.wallet_transactions
      for select using (auth.uid() = user_id);
  end if;
end$$;

-- Helpful index
create index if not exists wallet_tx_user_time_idx
  on public.wallet_transactions(user_id, created_at desc);

-- Return latest balance from ledger for current user
create or replace function public.ledger_balance()
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select balance_after::int from public.wallet_transactions where user_id = auth.uid() order by created_at desc limit 1),
    0
  );
$$;

-- Top-up via ledger; returns new balance
create or replace function public.ledger_topup(amount_cents int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  amt int := greatest(0, coalesce(amount_cents,0));
  last_bal int := coalesce((select balance_after::int from public.wallet_transactions where user_id = auth.uid() order by created_at desc limit 1), 0);
  new_bal int := last_bal + amt;
begin
  insert into public.wallet_transactions (user_id, type, amount_cents, balance_after)
  values (auth.uid(), 'topup', amt, new_bal);
  update public.profiles set balance_cents = new_bal, updated_at = now() where id = auth.uid();
  return new_bal;
end;
$$;

-- Charge via ledger; returns new balance or NULL if insufficient
create or replace function public.ledger_charge(amount_cents int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  amt int := greatest(0, coalesce(amount_cents,0));
  last_bal int := coalesce((select balance_after::int from public.wallet_transactions where user_id = auth.uid() order by created_at desc limit 1), 0);
  new_bal int;
begin
  if last_bal < amt then
    return null;
  end if;
  new_bal := last_bal - amt;
  insert into public.wallet_transactions (user_id, type, amount_cents, balance_after)
  values (auth.uid(), 'charge', amt, new_bal);
  update public.profiles set balance_cents = new_bal, updated_at = now() where id = auth.uid();
  return new_bal;
end;
$$;

grant execute on function public.ledger_balance() to anon, authenticated, service_role;
grant execute on function public.ledger_topup(int) to anon, authenticated, service_role;
grant execute on function public.ledger_charge(int) to anon, authenticated, service_role;

