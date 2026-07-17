-- Character-limit CHECK constraints for contest content columns.
--
-- Until now the limits only existed client-side (createContestSchema +
-- the detail page's inline editors); every column is unbounded `text`, so a
-- misbehaving client could store arbitrarily long values. These constraints
-- make the database the hard guarantee.
--
-- Keep the numbers in sync with packages/app/features/admin/contestFieldLimits.ts
-- (the client's single source of truth). Changing a limit needs BOTH an edit
-- there and a migration that drops + re-adds the matching constraint here.
--
-- Constraints are added NOT VALID so existing rows that might already exceed
-- a limit don't block the migration; they're enforced for all new writes and
-- updates.
--
-- IMPORTANT: NOT VALID only skips the initial table scan. On UPDATE, Postgres
-- still evaluates these CHECKs against the full row. Any legacy over-limit row
-- must be remediated (trim violating columns) before it can be updated.
--
-- To also verify old rows later (after remediation), run e.g.:
--   alter table public.contests validate constraint contests_title_len_chk;
-- (NULL values always pass a CHECK, so optional columns stay optional.)

-- contests ------------------------------------------------------------------

alter table public.contests
  add constraint contests_title_len_chk
    check (char_length(title) <= 100) not valid,
  add constraint contests_title_ms_len_chk
    check (char_length(title_ms) <= 100) not valid,
  add constraint contests_summary_len_chk
    check (char_length(summary) <= 200) not valid,
  add constraint contests_summary_ms_len_chk
    check (char_length(summary_ms) <= 200) not valid,
  add constraint contests_slug_len_chk
    check (char_length(slug) <= 200) not valid,
  add constraint contests_link_aff_shopee_len_chk
    check (char_length(link_aff_shopee) <= 1000) not valid,
  add constraint contests_link_aff_lazada_len_chk
    check (char_length(link_aff_lazada) <= 1000) not valid,
  add constraint contests_link_aff_tiktok_shop_len_chk
    check (char_length(link_aff_tiktok_shop) <= 1000) not valid,
  add constraint contests_link_media_instagram_len_chk
    check (char_length(link_media_instagram) <= 400) not valid,
  add constraint contests_link_media_facebook_len_chk
    check (char_length(link_media_facebook) <= 400) not valid,
  add constraint contests_link_media_tiktok_len_chk
    check (char_length(link_media_tiktok) <= 200) not valid,
  add constraint contests_link_media_x_len_chk
    check (char_length(link_media_x) <= 200) not valid,
  add constraint contests_link_media_youtube_len_chk
    check (char_length(link_media_youtube) <= 200) not valid,
  add constraint contests_link_media_linkedin_len_chk
    check (char_length(link_media_linkedin) <= 400) not valid,
  add constraint contests_link_media_website_len_chk
    check (char_length(link_media_website) <= 400) not valid;

-- contest_translations --------------------------------------------------------

alter table public.contest_translations
  add constraint ct_prizes_len_chk
    check (char_length(prizes) <= 2000) not valid,
  add constraint ct_link_tnc_len_chk
    check (char_length(link_tnc) <= 300) not valid,
  add constraint ct_link_faq_len_chk
    check (char_length(link_faq) <= 300) not valid,
  add constraint ct_eligible_products_len_chk
    check (char_length(eligible_products) <= 2400) not valid,
  add constraint ct_eligible_participants_len_chk
    check (char_length(eligible_participants) <= 1500) not valid,
  add constraint ct_eligible_participants_exclusion_len_chk
    check (char_length(eligible_participants_exclusion) <= 1000) not valid,
  add constraint ct_eligible_stores_len_chk
    check (char_length(eligible_stores) <= 2000) not valid,
  add constraint ct_winners_selection_method_len_chk
    check (char_length(winners_selection_method) <= 2000) not valid,
  add constraint ct_entry_method_len_chk
    check (char_length(entry_method) <= 2000) not valid,
  add constraint ct_winners_list_and_announcement_len_chk
    check (char_length(winners_list_and_announcement) <= 1000) not valid,
  add constraint ct_winners_comm_and_timeline_len_chk
    check (char_length(winners_comm_and_timeline) <= 1500) not valid;
