-- Phase 0 spike seed data: a handful of bilingual (EN/MS) Malaysian contests
-- so the public list + search/facets render with real-ish content.
-- Run automatically by `supabase db reset`.

-- Hosts -----------------------------------------------------------------------
insert into public.contest_hosts (id, name) values
  ('11111111-0000-0000-0000-000000000001', 'Shopee Malaysia'),
  ('11111111-0000-0000-0000-000000000002', 'Lazada'),
  ('11111111-0000-0000-0000-000000000003', 'TikTok Shop'),
  ('11111111-0000-0000-0000-000000000004', 'Watsons'),
  ('11111111-0000-0000-0000-000000000005', 'Nestlé Malaysia'),
  ('11111111-0000-0000-0000-000000000006', 'MILO Malaysia')
on conflict (id) do nothing;

-- Categories ------------------------------------------------------------------
insert into public.contest_categories (id, name_en, name_ms, slug, priority_order, type) values
  ('22222222-0000-0000-0000-000000000001', 'Electronics',     'Elektronik',        'electronics',    90, 'prize'),
  ('22222222-0000-0000-0000-000000000002', 'Groceries',       'Barangan Runcit',   'groceries',      80, 'prize'),
  ('22222222-0000-0000-0000-000000000003', 'Beauty',          'Kecantikan',        'beauty',         70, 'prize'),
  ('22222222-0000-0000-0000-000000000004', 'Cash Prize',      'Hadiah Tunai',      'cash-prize',    100, 'prize'),
  ('22222222-0000-0000-0000-000000000005', 'Travel',          'Pelancongan',       'travel',         60, 'prize'),
  ('22222222-0000-0000-0000-000000000006', 'Food & Beverage', 'Makanan & Minuman', 'food-beverage',  50, 'prize')
on conflict (id) do nothing;

-- Contests --------------------------------------------------------------------
insert into public.contests
  (id, slug, title, title_ms, summary, summary_ms, start_date, end_date, main_img_id, main_img_blurhash, total_prizes_value_rm, visibility)
values
  ('33333333-0000-0000-0000-000000000001', 'shopee-raya-grab-rewards',
   'Shopee Raya Grab Rewards', 'Ganjaran Raya Shopee',
   'Buy MILO and win cash prizes this Raya season.', 'Beli MILO dan menangi hadiah tunai sempena Raya.',
   now() - interval '5 days', now() + interval '25 days',
   'https://picsum.photos/seed/jc1/400/300', null, 50000, 'any'),

  ('33333333-0000-0000-0000-000000000002', 'lazada-electronics-giveaway',
   'Lazada Electronics Mega Giveaway', 'Cabutan Mega Elektronik Lazada',
   'Win the latest smartphones and laptops.', 'Menangi telefon pintar dan komputer riba terkini.',
   now() - interval '2 days', now() + interval '12 days',
   'https://picsum.photos/seed/jc2/400/300', null, 30000, 'any'),

  ('33333333-0000-0000-0000-000000000003', 'watsons-beauty-bonanza',
   'Watsons Beauty Bonanza', 'Bonanza Kecantikan Watsons',
   'Skincare hampers worth RM10,000 to be won.', 'Hamper penjagaan kulit bernilai RM10,000 untuk dimenangi.',
   now() - interval '10 days', now() + interval '3 days',
   'https://picsum.photos/seed/jc3/400/300', null, 10000, 'any'),

  ('33333333-0000-0000-0000-000000000004', 'milo-back-to-school',
   'MILO Back to School Contest', 'Peraduan MILO Kembali ke Sekolah',
   'Snap your MILO receipt and win school vouchers.', 'Rakam resit MILO anda dan menangi baucar sekolah.',
   now() - interval '1 day', now() + interval '40 days',
   'https://picsum.photos/seed/jc4/400/300', null, 15000, 'any'),

  ('33333333-0000-0000-0000-000000000005', 'tiktok-shop-travel-fest',
   'TikTok Shop Travel Fest', 'Pesta Pelancongan TikTok Shop',
   'Win a trip for two to Langkawi.', 'Menangi percutian berdua ke Langkawi.',
   now() - interval '7 days', now() + interval '7 days',
   'https://picsum.photos/seed/jc5/400/300', null, 20000, 'any'),

  ('33333333-0000-0000-0000-000000000006', 'nestle-groceries-grand-draw',
   'Nestlé Groceries Grand Draw', 'Cabutan Bertuah Barangan Nestlé',
   'Spend RM50 on Nestlé products to enter.', 'Belanja RM50 untuk produk Nestlé untuk menyertai.',
   now() - interval '3 days', now() + interval '18 days',
   'https://picsum.photos/seed/jc6/400/300', null, 25000, 'any'),

  ('33333333-0000-0000-0000-000000000007', 'shopee-cash-splash',
   'Shopee Cash Splash', 'Shopee Cash Splash',
   'Daily cash prizes all month long.', 'Hadiah tunai harian sepanjang bulan.',
   now() - interval '4 days', now() + interval '26 days',
   'https://picsum.photos/seed/jc7/400/300', null, 100000, 'any'),

  ('33333333-0000-0000-0000-000000000008', 'lazada-beauty-week',
   'Lazada Beauty Week', 'Minggu Kecantikan Lazada',
   'Premium beauty bundles up for grabs.', 'Bundel kecantikan premium menanti anda.',
   now() - interval '6 days', now() + interval '2 days',
   'https://picsum.photos/seed/jc8/400/300', null, 8000, 'any'),

  ('33333333-0000-0000-0000-000000000009', 'expired-raya-deal',
   'Expired Raya Deal', 'Tawaran Raya Tamat',
   'This contest has already ended.', 'Peraduan ini telah tamat.',
   now() - interval '60 days', now() - interval '5 days',
   'https://picsum.photos/seed/jc9/400/300', null, 5000, 'any'),

  -- Hidden contest: visibility = 'admin' must NOT appear for anon (RLS proof).
  ('33333333-0000-0000-0000-000000000010', 'secret-admin-only-contest',
   'Secret Admin-Only Contest', 'Peraduan Rahsia Admin Sahaja',
   'Should be hidden from anonymous users.', 'Sepatutnya tersembunyi daripada pengguna tanpa nama.',
   now() - interval '1 day', now() + interval '30 days',
   'https://picsum.photos/seed/jc10/400/300', null, 99999, 'admin')
on conflict (id) do nothing;

-- Host map --------------------------------------------------------------------
insert into public.contest_hosts_map (contest_id, host_id) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000006'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000005'),
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000005'),
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000001')
on conflict do nothing;

-- Category map ----------------------------------------------------------------
insert into public.contest_categories_map (contest_id, category_id) values
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000005'),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000010', '22222222-0000-0000-0000-000000000004')
on conflict do nothing;

-- Host logos ------------------------------------------------------------------
-- contest_hosts.img_id holds a storage object path OR an absolute URL (the
-- client's publicUrl() passes absolute URLs through unchanged). Uses
-- ui-avatars.com for stable brand-coloured placeholder logos.
update public.contest_hosts set img_id = 'https://ui-avatars.com/api/?name=Shopee&background=ee4d2d&color=fff&bold=true&size=128'  where id = '11111111-0000-0000-0000-000000000001';
update public.contest_hosts set img_id = 'https://ui-avatars.com/api/?name=Lazada&background=0f156d&color=fff&bold=true&size=128'  where id = '11111111-0000-0000-0000-000000000002';
update public.contest_hosts set img_id = 'https://ui-avatars.com/api/?name=TikTok&background=000000&color=fff&bold=true&size=128'  where id = '11111111-0000-0000-0000-000000000003';
update public.contest_hosts set img_id = 'https://ui-avatars.com/api/?name=Watsons&background=00a14b&color=fff&bold=true&size=128' where id = '11111111-0000-0000-0000-000000000004';
update public.contest_hosts set img_id = 'https://ui-avatars.com/api/?name=Nestle&background=005ca9&color=fff&bold=true&size=128' where id = '11111111-0000-0000-0000-000000000005';
update public.contest_hosts set img_id = 'https://ui-avatars.com/api/?name=Milo&background=009639&color=fff&bold=true&size=128'   where id = '11111111-0000-0000-0000-000000000006';

-- Gallery files (contest 1) ---------------------------------------------------
-- storage_path holds an object path OR absolute URL (publicUrl() passes through).
insert into public.contest_files (id, contest_id, storage_path, file_order) values
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'https://picsum.photos/seed/jc1a/800/600', 0),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 'https://picsum.photos/seed/jc1b/800/600', 1),
  ('44444444-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'https://picsum.photos/seed/jc1c/800/600', 2)
on conflict (id) do nothing;

-- Translations (contests 1 & 4, EN + MS) --------------------------------------
insert into public.contest_translations
  (contest_id, locale, prizes, eligible_products, eligible_participants, eligible_participants_exclusion, eligible_stores, winners_selection_method, entry_method, winners_list_and_announcement, winners_comm_and_timeline, link_tnc, link_faq)
values
  ('33333333-0000-0000-0000-000000000001', 'en',
   'RM50,000 cash prize pool: 1× RM20,000 grand prize, 3× RM5,000, 30× RM500 vouchers.',
   'Any MILO product purchased on Shopee Malaysia during the campaign period.',
   'Open to all Malaysian citizens aged 18 and above with a valid Shopee account.',
   'Employees of Nestlé Malaysia, Shopee and their immediate family members.',
   'Shopee Malaysia (official MILO flagship store).',
   'Winners drawn at random from all valid entries via a computerised system.',
   'Buy any MILO product, then submit your order ID in the campaign micro-site.',
   'Winners announced on the Shopee MILO flagship store page and via email.',
   'Winners contacted within 14 working days of the draw via email and Shopee chat.',
   'https://example.com/tnc/shopee-raya', 'https://example.com/faq/shopee-raya'),
  ('33333333-0000-0000-0000-000000000001', 'ms',
   'Hadiah tunai RM50,000: 1× RM20,000 hadiah utama, 3× RM5,000, 30× baucar RM500.',
   'Sebarang produk MILO yang dibeli di Shopee Malaysia sepanjang tempoh kempen.',
   'Terbuka kepada warganegara Malaysia berumur 18 tahun ke atas dengan akaun Shopee yang sah.',
   'Kakitangan Nestlé Malaysia, Shopee dan ahli keluarga terdekat mereka.',
   'Shopee Malaysia (gedung rasmi MILO).',
   'Pemenang dipilih secara rawak daripada semua penyertaan sah melalui sistem berkomputer.',
   'Beli sebarang produk MILO, kemudian hantar ID pesanan anda di mikro-tapak kempen.',
   'Pemenang diumumkan di halaman gedung MILO Shopee dan melalui e-mel.',
   'Pemenang dihubungi dalam masa 14 hari bekerja selepas cabutan melalui e-mel dan sembang Shopee.',
   'https://example.com/tnc/shopee-raya', 'https://example.com/faq/shopee-raya'),
  ('33333333-0000-0000-0000-000000000004', 'en',
   'RM15,000 worth of school vouchers: 100× RM150 vouchers up for grabs.',
   'MILO 2kg / 1kg packs purchased at participating stores.',
   'Open to parents/guardians who are Malaysian citizens.',
   'Employees of Nestlé Malaysia and their immediate family.',
   'All major hypermarkets nationwide.',
   'Weekly random draw from valid receipt submissions.',
   'Snap your MILO receipt and upload it in the app to enter.',
   'Weekly winners posted on the MILO Malaysia Facebook page.',
   'Winners notified via the app within 7 days of each weekly draw.',
   null, null)
on conflict (contest_id, locale) do nothing;
