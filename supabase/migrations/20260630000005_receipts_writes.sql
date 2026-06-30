-- Phase 4 (receipts): force receipt CREATION through the `receipts` Edge Function
-- so CAPTCHA + per-tier limits + rate limits are enforced server-side and cannot
-- be bypassed by a client writing straight to the table.
--
-- Clients keep:
--   * SELECT  -> needed to list receipts + mint owner-scoped signed URLs
--   * UPDATE  -> file_order reordering after a delete (notes still go through the
--                Edge Function for sanitization, but raw notes are never rendered
--                as HTML so this is defense-in-depth, not a hard requirement)
--   * DELETE  -> remove their own receipt (limit-neutral, kept client-side)
-- Clients lose:
--   * INSERT  -> only the Edge Function (service role) may create receipt rows
--
-- The matching storage object is uploaded by the client to "<uid>/..." first
-- (storage RLS confines it to their own prefix); the Edge Function finalizes the
-- DB row and deletes the orphan object if validation fails.

drop policy if exists "receipts_owner_all" on public.receipts;

create policy "receipts_owner_select" on public.receipts
  for select using (user_id = auth.uid());

create policy "receipts_owner_update" on public.receipts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "receipts_owner_delete" on public.receipts
  for delete using (user_id = auth.uid());

-- Creation is service-role only (via the Edge Function).
revoke insert on public.receipts from authenticated;
