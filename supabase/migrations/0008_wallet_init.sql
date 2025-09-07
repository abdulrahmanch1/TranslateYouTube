-- Create wallet init helpers to ensure a wallet is represented by an initial transaction

create or replace function public.ensure_wallet_for(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Create an initial transaction only if the user has no transactions
  if not exists (select 1 from public.wallet_transactions where user_id = uid) then
    insert into public.wallet_transactions (user_id, type, amount_cents, balance_after)
    values (uid, 'init', 0, 0);
  end if;
end;
$$;

create or replace function public.ensure_wallet()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_wallet_for(auth.uid());
end;
$$;

grant execute on function public.ensure_wallet_for(uuid) to anon, authenticated, service_role;
grant execute on function public.ensure_wallet() to anon, authenticated, service_role;

