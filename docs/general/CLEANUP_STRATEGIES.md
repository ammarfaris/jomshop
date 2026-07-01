# Rate Limits & Suspicious Activity Cleanup Strategies

## Problem

The `rate_limits` and `suspicious_activity` tables accumulate rows over time.
Without cleanup, they can grow indefinitely and impact performance.

Both tables live in Postgres, are **service-role only** (RLS blocks direct client
access), and have a `created_at` timestamp, so time-based cleanup is easy.

---

## Option 1: Scheduled cleanup with `pg_cron` (RECOMMENDED) ✅

### How It Works

- `pg_cron` runs a SQL statement on a schedule (e.g. daily at 3 AM UTC)
- Automatically deletes rows older than the retention period
- No manual intervention, no extra service to deploy

### Implementation

Enable the extension (once) and schedule the job:

```sql
-- 1. Enable pg_cron (Supabase Dashboard → Database → Extensions, or SQL)
create extension if not exists pg_cron;

-- 2. Delete rate-limit rows older than 90 days, every day at 3 AM UTC
select cron.schedule(
  'cleanup-rate-limits',
  '0 3 * * *',
  $$ delete from public.rate_limits
     where created_at < now() - interval '90 days' $$
);
```

**Retention Period:**

- Rate Limits: 90 days

**Note:** `suspicious_activity` is intentionally **not** auto-deleted. Keep it
indefinitely for security audits and compliance, or clean it up manually when
needed.

### Pros ✅

- **Fully automated** — set it and forget it
- **Consistent** — runs reliably on schedule
- **Configurable** — easy to adjust retention (change the `interval`)
- **In-database** — no separate function/service to deploy or pay for
- **Safe** — a single indexed `DELETE` on `created_at`

### Cons ❌

- Requires the `pg_cron` extension to be enabled
- Very large one-shot deletes can be heavy (batch if the backlog is huge)

### Cost

- **Negligible** — one small `DELETE` per day

---

## Option 2: Manual periodic cleanup (SQL editor)

### How It Works

- Run a `DELETE` in the Supabase SQL editor when you remember
- Requires human intervention

### Implementation

**Supabase Dashboard → SQL Editor:**

```sql
-- Delete rate-limit rows older than 90 days
delete from public.rate_limits
where created_at < now() - interval '90 days';
```

### Pros ✅

- No extension needed
- Simple to understand
- Full control over what gets deleted

### Cons ❌

- **Manual work** — you have to remember to do it
- **Inconsistent** — easy to forget
- **No logging** — no audit trail of the cleanup

---

## Comparison Table

| Feature              | `pg_cron` job        | Manual SQL                 |
| -------------------- | -------------------- | -------------------------- |
| **Automation**       | ✅ Fully automated   | ❌ Manual                  |
| **Consistency**      | ✅ Runs on schedule  | ❌ When you remember       |
| **Maintenance**      | ✅ Zero              | ❌ Regular work            |
| **Logging**          | ✅ `cron.job_run_details` | ❌ No audit trail     |
| **Setup Time**       | ~5 minutes           | 0 minutes                  |
| **Long-term Effort** | 0 minutes/month      | Recurring manual work      |

---

## Recommendation: `pg_cron` ✅

**Why?**

1. Set it once, runs forever
2. Stays inside Postgres — no extra infrastructure
3. Reliable and logged
4. Scales as your app grows

**When manual cleanup is fine:**

- Early development
- Very low traffic
- You check the database regularly anyway

---

## Deployment: `pg_cron` job

### Step 1: Enable the extension

Supabase Dashboard → **Database → Extensions** → enable `pg_cron`
(or run `create extension if not exists pg_cron;`).

### Step 2: Schedule the job

```sql
select cron.schedule(
  'cleanup-rate-limits',
  '0 3 * * *', -- daily at 3 AM UTC (lowest traffic)
  $$ delete from public.rate_limits
     where created_at < now() - interval '90 days' $$
);
```

### Step 3: Verify it's registered

```sql
select jobid, schedule, jobname, active
from cron.job
where jobname = 'cleanup-rate-limits';
```

### Step 4 (optional): Run once to test

```sql
delete from public.rate_limits
where created_at < now() - interval '90 days';
```

---

## Adjusting Retention Periods

Change the `interval` in the scheduled statement:

```sql
-- Example: keep only 30 days
select cron.unschedule('cleanup-rate-limits');
select cron.schedule(
  'cleanup-rate-limits',
  '0 3 * * *',
  $$ delete from public.rate_limits
     where created_at < now() - interval '30 days' $$
);
```

**Recommendations:**

- **Rate Limits**: 30–90 days (short-term abuse tracking)
- **Suspicious Activity**: keep indefinitely or clean up manually (audits, compliance)

---

## Monitoring

Check recent runs of the scheduled job:

```sql
select runid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'cleanup-rate-limits')
order by start_time desc
limit 10;
```

---

## Alternative: Scheduled Edge Function

If you prefer application code over SQL (e.g. to add custom logging or alerts),
a Supabase **Edge Function** can perform the same cleanup using the service role
key, triggered on a schedule (via `pg_cron` calling the function, or an external
scheduler). For pure time-based deletion, the in-database `pg_cron` `DELETE`
above is simpler and cheaper.

---

## Alternative: Partitioning

For very high-volume tables, consider **time-based partitioning** (e.g. monthly
partitions) so old data can be dropped instantly by dropping a partition instead
of running a large `DELETE`. This is overkill for typical rate-limit volumes but
worth knowing if the tables grow large.

---

## Summary

**For Production:** Use a **`pg_cron` scheduled DELETE** ✅

- Automated, reliable, in-database
- Costs effectively nothing
- Set once, works forever

**For Development:** Either works — manual SQL is fine while iterating.
