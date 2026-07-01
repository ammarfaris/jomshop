// @ts-nocheck Deno Edge Function — type-checked by Deno/Supabase on deploy, not
// by the app's Node/React Native tsconfig (which lacks Deno + remote-import types).
//
// Receipts Edge Function (Deno) — the server-side authority for receipt writes.
//
// Why this exists: clients can read their own receipts and mint owner-scoped
// signed URLs directly (RLS), but they may NOT create receipt rows (INSERT is
// revoked — see 20260630000005_receipts_writes.sql). All creation flows through
// here so we can enforce, un-bypassably:
//   * Cloudflare Turnstile CAPTCHA verification
//   * per-subscription-tier limits (contests-with-receipts + receipts-per-contest)
//   * per-user hourly rate limiting (+ suspicious-activity logging)
//   * notes sanitization
//
// Upload flow: the client uploads the file to "receipts/<uid>/..." first (storage
// RLS confines it to their own prefix), then calls this function with the object
// path. We validate, then either insert the DB row or delete the orphan object.
//
// Actions: { action: 'upload' | 'update-notes' | 'archive' | 'archive-contest', ... }
//   'archive'          archives the caller's own receipts for a contest (unsave)
//   'archive-contest'  admin-only: archives ALL users' receipts for a contest
//                      (run before deleting a contest)
//
// Deploy:  supabase functions deploy receipts
// Secrets: supabase secrets set TURNSTILE_SECRET_KEY=...
//   (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// SERVER-SIDE SOURCE OF TRUTH — must match TIER_FEATURES in SubscriptionContext.
const TIER_LIMITS: Record<
  string,
  { maxContests: number; maxReceipts: number }
> = {
  free: { maxContests: 5, maxReceipts: 3 },
  plus: { maxContests: -1, maxReceipts: 10 },
  pro: { maxContests: -1, maxReceipts: -1 },
}

// Per-user hourly cap (mirrors the Appwrite upload_receipt rate limit).
const MAX_UPLOADS_PER_HOUR = 50

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sanitizeNotes(input?: string): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '') // strip control chars
    .trim()
    .slice(0, 200)
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set')
    return false
  }
  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: token, remoteip: ip }),
      },
    )
    const result = await res.json()
    return result.success === true
  } catch (_e) {
    return false
  }
}

// deno-lint-ignore no-explicit-any
async function getTier(admin: any, uid: string): Promise<string> {
  const { data } = await admin
    .from('subscriptions')
    .select('tier, expires_at')
    .eq('user_id', uid)
    .maybeSingle()
  if (!data) return 'free'
  let tier = data.tier ?? 'free'
  if (data.expires_at && new Date(data.expires_at) < new Date()) tier = 'free'
  return TIER_LIMITS[tier] ? tier : 'free'
}

// deno-lint-ignore no-explicit-any
async function logSuspicious(
  admin: any,
  uid: string,
  ip: string,
  reason: string,
  metadata: Record<string, unknown>,
) {
  try {
    await admin
      .from('suspicious_activity')
      .insert({ user_id: uid, ip_address: ip, reason, metadata })
  } catch (_e) {
    // logging must never block the request
  }
}

// deno-lint-ignore no-explicit-any
async function checkAndRecordRateLimit(
  admin: any,
  uid: string,
  ip: string,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('action', 'upload_receipt')
      .gte('created_at', since)
    if ((count ?? 0) >= MAX_UPLOADS_PER_HOUR) return false
    await admin
      .from('rate_limits')
      .insert({ user_id: uid, ip_address: ip, action: 'upload_receipt' })
    return true
  } catch (_e) {
    // fail-open on the limiter itself (don't block legitimate users on infra hiccups)
    return true
  }
}

// deno-lint-ignore no-explicit-any
async function handleUpload(admin: any, uid: string, ip: string, body: any) {
  const { contestId, fileId, fileType, notes, captchaToken } = body

  if (!contestId || !fileId || !fileType) {
    return json(
      { success: false, error: 'Missing required fields' },
      400,
    )
  }

  // Defense-in-depth: the object must live under the caller's own prefix.
  if (!String(fileId).startsWith(`${uid}/`)) {
    return json({ success: false, error: 'Invalid file path' }, 403)
  }

  const cleanupOrphan = async () => {
    try {
      await admin.storage.from('receipts').remove([fileId])
    } catch (_e) {
      // best-effort
    }
  }

  // 1) CAPTCHA
  if (!captchaToken) {
    await cleanupOrphan()
    return json({ success: false, error: 'CAPTCHA verification required' }, 400)
  }
  if (!(await verifyTurnstile(captchaToken, ip))) {
    await logSuspicious(admin, uid, ip, 'captcha_failed', {
      action: 'upload_receipt',
    })
    await cleanupOrphan()
    return json({ success: false, error: 'CAPTCHA verification failed' }, 403)
  }

  // 2) Rate limit
  if (!(await checkAndRecordRateLimit(admin, uid, ip))) {
    await logSuspicious(admin, uid, ip, 'rate_limit_exceeded', {
      action: 'upload_receipt',
      limit: MAX_UPLOADS_PER_HOUR,
    })
    await cleanupOrphan()
    return json(
      {
        success: false,
        error: 'Too many uploads in the last hour. Please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
      },
      429,
    )
  }

  // 3) Tier limits
  const tier = await getTier(admin, uid)
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free

  const { data: existingForContest, error: existingErr } = await admin
    .from('receipts')
    .select('id')
    .eq('user_id', uid)
    .eq('contest_id', contestId)
  if (existingErr) {
    console.error('receipts: existing-rows lookup failed', existingErr)
    await cleanupOrphan()
    return json(
      { success: false, error: 'Validation failed', detail: existingErr.message },
      500,
    )
  }
  const contestReceiptCount = existingForContest?.length ?? 0

  // New contest for this user? Enforce contests-with-receipts cap.
  if (contestReceiptCount === 0 && limits.maxContests !== -1) {
    const { data: allRows } = await admin
      .from('receipts')
      .select('contest_id')
      .eq('user_id', uid)
      .limit(1000)
    const distinctContests = new Set(
      (allRows ?? []).map((r: { contest_id: string }) => r.contest_id),
    )
    if (distinctContests.size >= limits.maxContests) {
      await cleanupOrphan()
      const upgrade =
        tier === 'free'
          ? 'Upgrade to Plus or Pro for more contests.'
          : 'Upgrade to Pro for unlimited contests.'
      return json(
        {
          success: false,
          error: `You've reached the maximum of ${limits.maxContests} contests with receipts. ${upgrade}`,
          errorCode: 'MAX_CONTESTS_REACHED',
        },
        403,
      )
    }
  }

  // Receipts-per-contest cap.
  if (limits.maxReceipts !== -1 && contestReceiptCount >= limits.maxReceipts) {
    await cleanupOrphan()
    const upgrade =
      tier === 'free'
        ? 'Upgrade to Plus for 10 receipts per contest, or Pro for unlimited.'
        : 'Upgrade to Pro for unlimited receipts.'
    return json(
      {
        success: false,
        error: `Maximum ${limits.maxReceipts} receipts per contest. ${upgrade}`,
        errorCode: 'MAX_RECEIPTS_PER_CONTEST_REACHED',
      },
      403,
    )
  }

  // 4) Insert (service role; file_order is server-derived to avoid gaps/races)
  const cleanNotes = sanitizeNotes(notes)
  const { data: row, error: insertErr } = await admin
    .from('receipts')
    .insert({
      user_id: uid,
      contest_id: contestId,
      file_id: fileId,
      notes: cleanNotes,
      file_type: fileType,
      file_order: contestReceiptCount,
    })
    .select()
    .single()

  if (insertErr || !row) {
    console.error('receipts: insert failed', insertErr)
    await cleanupOrphan()
    return json(
      { success: false, error: 'Failed to save receipt', detail: insertErr?.message },
      500,
    )
  }

  // Phase 5: on the user's TRUE first receipt this marks has_uploaded_receipt
  // and pays out any pending referral bonus. Idempotent + best-effort: a points
  // hiccup must never fail an otherwise-successful upload.
  try {
    await admin.rpc('complete_referral_on_first_receipt', { p_user: uid })
  } catch (e) {
    console.error('receipts: referral completion failed', e)
  }

  return json({ success: true, data: row }, 201)
}

// deno-lint-ignore no-explicit-any
async function handleUpdateNotes(admin: any, uid: string, body: any) {
  const { receiptId, notes } = body
  if (!receiptId) {
    return json({ success: false, error: 'Missing receiptId' }, 400)
  }

  const { data: existing } = await admin
    .from('receipts')
    .select('id, user_id')
    .eq('id', receiptId)
    .maybeSingle()
  if (!existing || existing.user_id !== uid) {
    return json({ success: false, error: 'Receipt not found' }, 404)
  }

  const { data: row, error } = await admin
    .from('receipts')
    .update({ notes: sanitizeNotes(notes) })
    .eq('id', receiptId)
    .select()
    .single()
  if (error || !row) {
    return json({ success: false, error: 'Failed to update notes' }, 500)
  }
  return json({ success: true, data: row }, 200)
}

// Archive a set of receipt rows: for each, move file -> archive bucket, record
// the archive row, then delete the active row. Ordered so a failure at any step
// never loses a receipt (worst case: a harmless archived+active duplicate).
// deno-lint-ignore no-explicit-any
async function archiveReceiptRows(
  admin: any,
  // deno-lint-ignore no-explicit-any
  rows: any[],
  reason: string,
): Promise<{ archivedCount: number; errors: string[] }> {
  let archivedCount = 0
  const errors: string[] = []

  for (const r of rows) {
    try {
      // 1) Move the object into the service-role-only archive bucket FIRST. If
      //    this fails, skip the row entirely so we never delete an active receipt
      //    whose file is still live (that's the data-loss case archiving prevents).
      const { error: moveErr } = await admin.storage
        .from('receipts')
        .move(r.file_id, r.file_id, { destinationBucket: 'receipts-archive' })
      if (moveErr) {
        errors.push(`move ${r.file_id}: ${moveErr.message}`)
        continue
      }

      // 2) Record the archive row. If this fails, move the object back so the
      //    still-active receipt keeps pointing at a valid file.
      const { error: insErr } = await admin.from('receipts_archive').insert({
        contest_id: r.contest_id,
        user_id: r.user_id,
        file_id: r.file_id,
        notes: r.notes,
        file_order: r.file_order,
        file_type: r.file_type,
        archived_reason: reason,
      })
      if (insErr) {
        await admin.storage
          .from('receipts-archive')
          .move(r.file_id, r.file_id, { destinationBucket: 'receipts' })
        errors.push(`archive-insert ${r.file_id}: ${insErr.message}`)
        continue
      }

      // 3) Only now remove the active row. A failure here leaves a harmless
      //    duplicate (archived + active) rather than losing the receipt.
      const { error: delErr } = await admin
        .from('receipts')
        .delete()
        .eq('id', r.id)
      if (delErr) {
        errors.push(`delete ${r.id}: ${delErr.message}`)
        continue
      }
      archivedCount++
    } catch (e) {
      errors.push(String(e))
    }
  }

  return { archivedCount, errors }
}

// deno-lint-ignore no-explicit-any
async function isAdmin(admin: any, uid: string): Promise<boolean> {
  // Checked with the service-role client (no auth.uid() context), so query
  // user_roles directly rather than the is_admin() RLS helper.
  const { data } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', uid)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
}

// deno-lint-ignore no-explicit-any
async function handleArchive(admin: any, uid: string, body: any) {
  const { contestId, reason } = body
  if (!contestId) {
    return json({ success: false, error: 'Missing contestId' }, 400)
  }

  const { data: rows } = await admin
    .from('receipts')
    .select('*')
    .eq('user_id', uid)
    .eq('contest_id', contestId)

  if (!rows || rows.length === 0) {
    return json({ success: true, archivedCount: 0, errors: [] }, 200)
  }

  const { archivedCount, errors } = await archiveReceiptRows(
    admin,
    rows,
    reason ?? 'Contest unsaved by user',
  )
  return json({ success: errors.length === 0, archivedCount, errors }, 200)
}

// Admin-only: archive EVERY user's receipts for a contest. Used right before an
// admin deletes the contest, whose FK cascade would otherwise drop the receipt
// rows outright. Gated by is_admin so a normal user can't archive others' data.
// deno-lint-ignore no-explicit-any
async function handleArchiveContest(admin: any, uid: string, body: any) {
  const { contestId, reason } = body
  if (!contestId) {
    return json({ success: false, error: 'Missing contestId' }, 400)
  }
  if (!(await isAdmin(admin, uid))) {
    return json({ success: false, error: 'Admin privileges required' }, 403)
  }

  let archivedCount = 0
  let lastErrors: string[] = []
  let complete = false

  // Archive in batches. A successful archive deletes the row, so re-querying
  // returns the remainder; stop when the contest has no active receipts left
  // (success) or when a whole batch archives nothing (a row we can't move — stop
  // rather than loop forever). Success is decided by the END STATE, not by a
  // transient per-row error on an earlier batch that a later batch then clears.
  while (true) {
    const { data: rows, error } = await admin
      .from('receipts')
      .select('*')
      .eq('contest_id', contestId)
      .limit(200)
    if (error) {
      lastErrors = [`fetch: ${error.message}`]
      break
    }
    if (!rows || rows.length === 0) {
      complete = true
      break
    }

    const res = await archiveReceiptRows(
      admin,
      rows,
      reason ?? 'Contest deleted by admin',
    )
    archivedCount += res.archivedCount
    if (res.archivedCount === 0) {
      // No progress: the remaining rows can't be archived. Stop and report
      // failure so the caller aborts the delete (active receipts still remain).
      lastErrors = res.errors
      break
    }
    // Progress made; ignore any per-row errors this round — the rows that failed
    // stay active and get retried on the next fetch.
  }

  return json(
    { success: complete, archivedCount, errors: complete ? [] : lastErrors },
    200,
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    // Identify the caller from their JWT.
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return json({ success: false, error: 'Unauthorized' }, 401)

    // Privileged client for the actual writes.
    const admin = createClient(url, serviceKey)

    const body = await req.json().catch(() => ({}))
    switch (body.action) {
      case 'upload':
        return await handleUpload(admin, uid, ip, body)
      case 'update-notes':
        return await handleUpdateNotes(admin, uid, body)
      case 'archive':
        return await handleArchive(admin, uid, body)
      case 'archive-contest':
        return await handleArchiveContest(admin, uid, body)
      default:
        return json(
          { success: false, error: `Unknown action: ${body.action}` },
          400,
        )
    }
  } catch (e) {
    return json({ success: false, error: 'Internal error', detail: String(e) }, 500)
  }
})
