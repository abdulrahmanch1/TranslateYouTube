-- Recreate ledger RPCs to avoid touching profiles snapshot

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
  return new_bal;
end;
$$;

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
  return new_bal;
end;
$$;

grant execute on function public.ledger_balance() to anon, authenticated, service_role;
grant execute on function public.ledger_topup(int) to anon, authenticated, service_role;
grant execute on function public.ledger_charge(int) to anon, authenticated, service_role;

