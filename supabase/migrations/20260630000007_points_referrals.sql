-- Phase 5: Points + Referrals business logic.
--
-- The tables already exist (20260630000003_user_data.sql): points_accounts,
-- points_ledger, referrals, referral_settings, subscriptions. This migration
-- adds ONLY the award/redeem/completion logic + the signup bonus, replacing the
-- Appwrite functions (initialize-user-points / get-user-points /
-- redeem-points-for-subscription / redeem-referral-code / award-points).
--
-- Tunables — single source of truth (the client mirrors these for display):
--   SIGNUP_BONUS        = 100   (granted once on account creation)
--   REFERRAL_BONUS      = 200   (each side, on the referee's first receipt)
--   REDEEM_PLUS_COST    = 1500  /  REDEEM_PRO_COST = 3000
--   REDEEM_DURATION     = 30 days  (redeeming extends an existing subscription)

-- Running balance per ledger row so the UI can show "balance after" each txn.
alter table public.points_ledger
  add column if not exists balance_after int;

-- ===========================================================================
-- award_points: the ONLY way points move. SECURITY DEFINER + locked down so a
-- client can never call it directly to mint themselves points; redeem/complete
-- functions (also DEFINER) call it internally.
-- ===========================================================================
create or replace function public.award_points(
  p_user        uuid,
  p_amount      int,            -- always positive
  p_type        text,           -- 'earn' | 'spend'
  p_source      text,
  p_description text,
  p_metadata    jsonb default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
begin
  insert into public.points_accounts (user_id) values (p_user)
    on conflict (user_id) do nothing;

  if p_type = 'earn' then
    update public.points_accounts
      set balance = balance + p_amount,
          lifetime_earned = lifetime_earned + p_amount,
          updated_at = now()
      where user_id = p_user
      returning balance into v_new_balance;
  else
    update public.points_accounts
      set balance = balance - p_amount,
          lifetime_spent = lifetime_spent + p_amount,
          updated_at = now()
      where user_id = p_user
      returning balance into v_new_balance;
  end if;

  insert into public.points_ledger
    (user_id, amount, type, source, description, metadata, balance_after)
  values
    (p_user, p_amount, p_type, p_source, p_description, p_metadata, v_new_balance);

  return v_new_balance;
end;
$$;

-- ===========================================================================
-- Signup bonus: separate trigger so the existing profile trigger is untouched.
-- Idempotent (the 'signup' ledger row is created at most once per user).
-- ===========================================================================
create or replace function public.handle_new_user_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.points_accounts (user_id, balance, lifetime_earned)
    values (new.id, 100, 100)               -- SIGNUP_BONUS
    on conflict (user_id) do nothing;

  insert into public.points_ledger
    (user_id, amount, type, source, description, balance_after)
  select new.id, 100, 'earn', 'signup', 'Welcome bonus', 100
  where not exists (
    select 1 from public.points_ledger
    where user_id = new.id and source = 'signup'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_points on auth.users;
create trigger on_auth_user_created_points
  after insert on auth.users
  for each row execute function public.handle_new_user_points();

-- ===========================================================================
-- redeem_points_for_subscription: spend points -> extend/grant a subscription.
-- Called by the authenticated user (RPC). Atomic: balance is locked FOR UPDATE.
-- ===========================================================================
create or replace function public.redeem_points_for_subscription(p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_cost           int;
  v_days           int := 30;               -- REDEEM_DURATION
  v_balance        int;
  v_new_balance    int;
  v_current_expiry timestamptz;
  v_new_expiry     timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  if p_tier = 'plus' then v_cost := 1500;
  elsif p_tier = 'pro' then v_cost := 3000;
  else return jsonb_build_object('success', false, 'error', 'Invalid tier');
  end if;

  insert into public.points_accounts (user_id) values (v_uid)
    on conflict (user_id) do nothing;

  select balance into v_balance
    from public.points_accounts where user_id = v_uid for update;
  v_balance := coalesce(v_balance, 0);

  if v_balance < v_cost then
    return jsonb_build_object(
      'success', false,
      'error', format('Insufficient points. You need %s more points.', v_cost - v_balance),
      'details', jsonb_build_object('required', v_cost, 'current', v_balance, 'needed', v_cost - v_balance)
    );
  end if;

  -- Extend from the later of now / current expiry so users don't lose time.
  select expires_at into v_current_expiry
    from public.subscriptions where user_id = v_uid;
  v_new_expiry := greatest(now(), coalesce(v_current_expiry, now()))
                  + make_interval(days => v_days);

  insert into public.subscriptions (user_id, tier, source, expires_at, auto_renew)
  values (v_uid, p_tier, 'points', v_new_expiry, false)
  on conflict (user_id) do update
    set tier = excluded.tier,
        source = 'points',
        expires_at = v_new_expiry,
        auto_renew = false,
        updated_at = now();

  v_new_balance := public.award_points(
    v_uid, v_cost, 'spend', 'subscription',
    format('Redeemed %s points for %s subscription', v_cost, p_tier)
  );

  return jsonb_build_object(
    'success', true,
    'redemption', jsonb_build_object(
      'tier', p_tier,
      'pointsSpent', v_cost,
      'previousBalance', v_balance,
      'newBalance', v_new_balance,
      'expiresAt', v_new_expiry,
      'daysAdded', v_days
    )
  );
end;
$$;

-- ===========================================================================
-- redeem_referral_code: the referee enters the referrer's user id (= code).
-- Creates a PENDING referral; the bonus is paid on the referee's first receipt.
-- ===========================================================================
create or replace function public.redeem_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_referrer       uuid;
  v_referrer_email text;
  v_referrer_name  text;
  v_referee_email  text;
  v_referee_name   text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  begin
    v_referrer := p_code::uuid;
  exception when others then
    return jsonb_build_object('success', false, 'error', 'Invalid referral code');
  end;

  if v_referrer = v_uid then
    return jsonb_build_object('success', false, 'error', 'You cannot use your own referral code');
  end if;

  select email, full_name into v_referrer_email, v_referrer_name
    from public.profiles where id = v_referrer;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Referral code not found');
  end if;

  if exists (select 1 from public.referrals where referee_user_id = v_uid) then
    return jsonb_build_object('success', false, 'error', 'You have already redeemed a referral code');
  end if;

  select email, full_name into v_referee_email, v_referee_name
    from public.profiles where id = v_uid;

  insert into public.referrals (
    referrer_user_id, referee_user_id, referral_code, status,
    referee_email, referee_fullname, referrer_email, referrer_fullname
  ) values (
    v_referrer, v_uid, p_code, 'pending',
    v_referee_email, v_referee_name, v_referrer_email, v_referrer_name
  );

  return jsonb_build_object('success', true);
end;
$$;

-- ===========================================================================
-- complete_referral_on_first_receipt: called by the receipts Edge Function
-- (service role) after every insert. Idempotent — only the user's TRUE first
-- receipt pays out. Referee always gets the bonus; referrer only within limit.
-- ===========================================================================
create or replace function public.complete_referral_on_first_receipt(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already   boolean;
  v_referral  public.referrals%rowtype;
  v_max       int;
  v_completed int;
  v_receipts  int;
begin
  select has_uploaded_receipt into v_already
    from public.points_accounts where user_id = p_user;
  if v_already is true then
    return;                         -- not their first receipt; nothing to do
  end if;

  -- Defense-in-depth: the flag is the primary first-receipt signal, but also
  -- confirm against the receipts table so a drifted/backfilled flag can never
  -- pay a bonus on a non-first upload. This fn runs AFTER the insert, so a
  -- genuine first receipt leaves exactly one row.
  select count(*) into v_receipts from public.receipts where user_id = p_user;
  if v_receipts > 1 then
    -- Pre-existing receipts: set the flag so future calls short-circuit, no payout.
    insert into public.points_accounts (user_id, has_uploaded_receipt)
      values (p_user, true)
      on conflict (user_id) do update
        set has_uploaded_receipt = true, updated_at = now();
    return;
  end if;

  insert into public.points_accounts (user_id, has_uploaded_receipt)
    values (p_user, true)
    on conflict (user_id) do update
      set has_uploaded_receipt = true, updated_at = now();

  select * into v_referral
    from public.referrals
    where referee_user_id = p_user and status = 'pending'
    limit 1;
  if not found then
    return;
  end if;

  select max_referrals into v_max
    from public.referral_settings where user_id = v_referral.referrer_user_id;
  v_max := coalesce(v_max, 10);    -- default cap

  select count(*) into v_completed
    from public.referrals
    where referrer_user_id = v_referral.referrer_user_id and status = 'completed';

  -- Referee always earns their bonus.
  perform public.award_points(
    p_user, 200, 'earn', 'referral', 'Referral bonus (you were referred)'
  );

  if v_max > 0 and v_completed < v_max then
    perform public.award_points(
      v_referral.referrer_user_id, 200, 'earn', 'referral',
      'Referral bonus (friend uploaded first receipt)'
    );
    update public.referrals
      set status = 'completed', points_awarded = 200, completed_at = now()
      where id = v_referral.id;
    update public.points_accounts
      set completed_referrals_count = completed_referrals_count + 1, updated_at = now()
      where user_id = v_referral.referrer_user_id;
  else
    -- Referrer at/over their limit: referee keeps the bonus, referrer gets none.
    update public.referrals
      set status = 'limit_reached', points_awarded = 200, completed_at = now()
      where id = v_referral.id;
  end if;
end;
$$;

-- ===========================================================================
-- admin_adjust_points: admin-only manual grant/deduction (positive earns,
-- negative spends). Guarded by is_admin(); records an 'admin'-sourced ledger row.
-- ===========================================================================
create or replace function public.admin_adjust_points(
  p_user        uuid,
  p_amount      int,
  p_description text,
  p_metadata    jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;
  if p_amount = 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be non-zero');
  end if;

  if p_amount > 0 then
    v_new_balance := public.award_points(
      p_user, p_amount, 'earn', 'admin', p_description, p_metadata
    );
  else
    v_new_balance := public.award_points(
      p_user, abs(p_amount), 'spend', 'admin', p_description, p_metadata
    );
  end if;

  return jsonb_build_object('success', true, 'newBalance', v_new_balance);
end;
$$;

-- ===========================================================================
-- Privileges. Internal functions must NOT be client-callable (they're DEFINER
-- and would otherwise let a user mint points). Redeem functions are for users.
-- ===========================================================================
revoke all on function public.award_points(uuid, int, text, text, text, jsonb) from public;
revoke all on function public.complete_referral_on_first_receipt(uuid) from public;
grant execute on function public.complete_referral_on_first_receipt(uuid) to service_role;

revoke all on function public.redeem_points_for_subscription(text) from public;
grant execute on function public.redeem_points_for_subscription(text) to authenticated;

revoke all on function public.redeem_referral_code(text) from public;
grant execute on function public.redeem_referral_code(text) to authenticated;

revoke all on function public.admin_adjust_points(uuid, int, text, jsonb) from public;
grant execute on function public.admin_adjust_points(uuid, int, text, jsonb) to authenticated;
