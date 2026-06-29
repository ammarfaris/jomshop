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
