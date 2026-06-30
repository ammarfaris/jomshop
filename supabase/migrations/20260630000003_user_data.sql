-- Phase 1: per-user data tables (engagement, receipts, points, subscriptions,
-- referrals, feedback) + server-side ops tables. Column names mirror the
-- Appwrite collections (contestUpvotes, usersReceipts, userPoints, …) so the
-- per-feature client rewrites in later phases stay close to 1:1.
--
-- RLS convention:
--   * user-owned rows  -> visible/insertable/deletable only by the owner
--   * points/subs/ledger writes happen via SECURITY DEFINER RPCs / service role
--     (Edge Functions) — users get SELECT only
--   * admins can read everything (public.is_admin())
--   * ops tables (rate_limits, suspicious_activity) are service-role only

-- ===========================================================================
-- Engagement: upvotes + saves
-- ===========================================================================
create table if not exists public.upvotes (
  id         uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contest_id, user_id)
);
create index if not exists upvotes_contest_idx on public.upvotes (contest_id);
create index if not exists upvotes_user_idx    on public.upvotes (user_id);

create table if not exists public.saves (
  id         uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contest_id, user_id)
);
create index if not exists saves_user_created_idx on public.saves (user_id, created_at desc);

-- Keep contests.upvote_count denormalized so anon list/detail can show counts
-- without exposing who upvoted. SECURITY DEFINER -> bypasses contests RLS.
create or replace function public.sync_contest_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.contests set upvote_count = upvote_count + 1 where id = new.contest_id;
  elsif (tg_op = 'DELETE') then
    update public.contests set upvote_count = greatest(upvote_count - 1, 0) where id = old.contest_id;
  end if;
  return null;
end;
$$;

drop trigger if exists upvotes_sync_count on public.upvotes;
create trigger upvotes_sync_count
  after insert or delete on public.upvotes
  for each row execute function public.sync_contest_upvote_count();

alter table public.upvotes enable row level security;
alter table public.saves   enable row level security;

drop policy if exists "upvotes_owner_all" on public.upvotes;
create policy "upvotes_owner_all" on public.upvotes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "saves_owner_all" on public.saves;
create policy "saves_owner_all" on public.saves
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, delete on public.upvotes to authenticated;
grant select, insert, delete on public.saves   to authenticated;

-- ===========================================================================
-- Receipts (+ archive). Files live in the private 'receipts' storage bucket;
-- file_id holds the object path. Mirrors usersReceipts / usersReceiptsArchive.
-- ===========================================================================
create table if not exists public.receipts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  file_id    text not null,
  notes      text default '',
  file_type  text not null,
  file_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists receipts_user_idx         on public.receipts (user_id);
create index if not exists receipts_user_contest_idx on public.receipts (user_id, contest_id);
create index if not exists receipts_contest_idx      on public.receipts (contest_id);

create table if not exists public.receipts_archive (
  id              uuid primary key default gen_random_uuid(),
  contest_id      uuid references public.contests(id) on delete cascade,
  user_id         uuid not null,
  file_id         text not null,
  notes           text,
  file_order      int not null default 0,
  file_type       text not null,
  archived_reason text,
  archived_at     timestamptz not null default now()
);

alter table public.receipts         enable row level security;
alter table public.receipts_archive enable row level security;

drop policy if exists "receipts_owner_all" on public.receipts;
create policy "receipts_owner_all" on public.receipts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "receipts_admin_read" on public.receipts;
create policy "receipts_admin_read" on public.receipts
  for select using (public.is_admin());

drop policy if exists "receipts_archive_admin_read" on public.receipts_archive;
create policy "receipts_archive_admin_read" on public.receipts_archive
  for select using (public.is_admin());

grant select, insert, update, delete on public.receipts to authenticated;
grant select on public.receipts_archive to authenticated;

-- ===========================================================================
-- Points: account snapshot + immutable ledger. Writes via RPC / service role.
-- Mirrors userPoints / pointsTransactions.
-- ===========================================================================
create table if not exists public.points_accounts (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  balance                   int not null default 0,
  lifetime_earned           int not null default 0,
  lifetime_spent            int not null default 0,
  completed_referrals_count int not null default 0,
  has_uploaded_receipt      boolean not null default false,
  updated_at                timestamptz not null default now()
);

create table if not exists public.points_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      int not null,
  type        text not null check (type in ('earn', 'spend')),
  source      text not null check (source in ('signup', 'referral', 'receipt', 'subscription', 'purchase', 'admin')),
  description text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id, created_at desc);

drop trigger if exists points_accounts_set_updated_at on public.points_accounts;
create trigger points_accounts_set_updated_at
  before update on public.points_accounts
  for each row execute function public.set_updated_at();

alter table public.points_accounts enable row level security;
alter table public.points_ledger   enable row level security;

drop policy if exists "points_accounts_self_read" on public.points_accounts;
create policy "points_accounts_self_read" on public.points_accounts
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "points_ledger_self_read" on public.points_ledger;
create policy "points_ledger_self_read" on public.points_ledger
  for select using (user_id = auth.uid() or public.is_admin());

grant select on public.points_accounts to authenticated;
grant select on public.points_ledger   to authenticated;

-- ===========================================================================
-- Subscriptions. Writes via the RevenueCat webhook (service role). Mirrors
-- userSubscriptions.
-- ===========================================================================
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  revenuecat_customer_id text,
  last_event_id          text,
  tier                   text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  source                 text not null default 'none' check (source in ('none', 'money', 'points')),
  expires_at             timestamptz,
  auto_renew             boolean not null default false,
  auto_renew_failed_at   timestamptz,
  auto_renew_next_tier   text check (auto_renew_next_tier in ('plus', 'pro')),
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_rc_customer_idx
  on public.subscriptions (revenuecat_customer_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_self_read" on public.subscriptions;
create policy "subscriptions_self_read" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

grant select on public.subscriptions to authenticated;

-- ===========================================================================
-- Referrals + per-user settings. Writes via the redeem-referral RPC / service
-- role. Mirrors userReferrals / referralSettings.
-- ===========================================================================
create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_user_id  uuid not null references auth.users(id) on delete cascade,
  referee_user_id   uuid not null references auth.users(id) on delete cascade,
  referral_code     text not null,
  status            text not null,
  points_awarded    int default 0,
  first_receipt_id  uuid,
  completed_at      timestamptz,
  referee_email     text,
  referee_fullname  text,
  referrer_email    text,
  referrer_fullname text,
  created_at        timestamptz not null default now(),
  unique (referee_user_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id);
create index if not exists referrals_code_idx     on public.referrals (referral_code);
create index if not exists referrals_status_idx   on public.referrals (status);

create table if not exists public.referral_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  max_referrals  int not null default 10,
  notes          text,
  modified_by    uuid,
  previous_limit int,
  updated_at     timestamptz not null default now()
);

drop trigger if exists referral_settings_set_updated_at on public.referral_settings;
create trigger referral_settings_set_updated_at
  before update on public.referral_settings
  for each row execute function public.set_updated_at();

alter table public.referrals         enable row level security;
alter table public.referral_settings enable row level security;

drop policy if exists "referrals_participant_read" on public.referrals;
create policy "referrals_participant_read" on public.referrals
  for select using (
    referrer_user_id = auth.uid()
    or referee_user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "referral_settings_self_read" on public.referral_settings;
create policy "referral_settings_self_read" on public.referral_settings
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "referral_settings_admin_write" on public.referral_settings;
create policy "referral_settings_admin_write" on public.referral_settings
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.referrals to authenticated;
grant select, insert, update, delete on public.referral_settings to authenticated;

-- ===========================================================================
-- Feedback. Authenticated users insert their own; admins read. Mirrors
-- usersFeedback.
-- ===========================================================================
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  page_url   text,
  user_name  text,
  user_email text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_self_insert" on public.feedback;
create policy "feedback_self_insert" on public.feedback
  for insert with check (user_id = auth.uid());

drop policy if exists "feedback_admin_read" on public.feedback;
create policy "feedback_admin_read" on public.feedback
  for select using (public.is_admin());

grant select, insert on public.feedback to authenticated;

-- ===========================================================================
-- Ops tables: server-side only (RLS on, no user policies -> service role only).
-- Admins may read for moderation. Mirrors rateLimits / suspiciousActivity.
-- ===========================================================================
create table if not exists public.rate_limits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  ip_address text,
  action     text not null,
  user_name  text,
  user_email text,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_lookup_idx
  on public.rate_limits (user_id, action, created_at);

create table if not exists public.suspicious_activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  ip_address text,
  reason     text not null,
  metadata   jsonb,
  user_name  text,
  user_email text,
  created_at timestamptz not null default now()
);

alter table public.rate_limits         enable row level security;
alter table public.suspicious_activity enable row level security;

drop policy if exists "rate_limits_admin_read" on public.rate_limits;
create policy "rate_limits_admin_read" on public.rate_limits
  for select using (public.is_admin());

drop policy if exists "suspicious_activity_admin_read" on public.suspicious_activity;
create policy "suspicious_activity_admin_read" on public.suspicious_activity
  for select using (public.is_admin());

grant select on public.rate_limits         to authenticated;
grant select on public.suspicious_activity to authenticated;
