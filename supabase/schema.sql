-- ============================================================
-- XXI INVENTORY — Supabase Schema
-- Jalankan ini di Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PRODUCTS
-- ============================================================
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  produk      text not null,
  ket_orderan text not null default '',   -- WEEKLY / kosong
  ket_barang  text not null default '',   -- USAGE / KANTOR / kosong
  stock_awal  integer not null default 0,
  sisa_stok   integer not null default 0,
  is_weekly   boolean generated always as (
                upper(ket_orderan) = 'WEEKLY'
              ) stored,
  is_usage    boolean generated always as (
                upper(ket_barang) like '%USAGE%'
              ) stored,
  urutan      integer not null default 0,  -- untuk sorting sesuai urutan spreadsheet
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Index untuk pencarian produk
create index if not exists products_produk_idx on public.products (lower(produk));
create index if not exists products_aktif_idx  on public.products (aktif);


-- ============================================================
-- 2. EXPIRATION BATCHES
-- ============================================================
create table if not exists public.expiration_batches (
  id          text primary key,             -- EXP-000001 dst
  produk      text not null,
  exp_date    date not null,
  qty_awal    integer not null default 0,
  qty_tersisa integer not null default 0,
  created_at  timestamptz not null default now(),
  status      text not null default 'AKTIF'  -- diupdate via trigger
);

-- Auto-compute status on insert/update
create or replace function public.compute_exp_status()
returns trigger language plpgsql as $$
begin
  new.status :=
    case
      when new.qty_tersisa <= 0        then 'HABIS'
      when new.exp_date < current_date then 'EXPIRED'
      when new.exp_date - current_date <= 30 then 'SEGERA EXPIRED'
      else 'AKTIF'
    end;
  return new;
end;
$$;

create trigger exp_batches_status
  before insert or update on public.expiration_batches
  for each row execute function public.compute_exp_status();

create index if not exists exp_batches_produk_idx   on public.expiration_batches (lower(produk));
create index if not exists exp_batches_exp_date_idx on public.expiration_batches (exp_date);
create index if not exists exp_batches_qty_idx      on public.expiration_batches (qty_tersisa) where qty_tersisa > 0;


-- ============================================================
-- 3. TRANSACTIONS (LOG)
-- ============================================================
create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  tipe               text not null check (tipe in ('PENAMBAHAN','PENGURANGAN')),
  produk             text not null,
  jumlah             integer not null check (jumlah > 0),
  input_mode         text not null default 'HARIAN' check (input_mode in ('HARIAN','MINGGUAN')),
  ref                text not null default '',   -- "Hari 7" / "Minggu 1"
  exp_date           date,                        -- nullable, hanya untuk PENAMBAHAN
  sisa_stok_setelah  integer                      -- nullable untuk data lama
);

create index if not exists transactions_produk_idx     on public.transactions (lower(produk));
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_tipe_idx       on public.transactions (tipe);


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- Karena aplikasi ini single-user / internal tanpa auth,
-- kita gunakan anon key dengan RLS yang mengizinkan semua.
-- Ganti dengan policy berbasis auth jika perlu login.
-- ============================================================
alter table public.products           enable row level security;
alter table public.expiration_batches enable row level security;
alter table public.transactions       enable row level security;

-- Allow semua operasi via anon key (internal tool)
create policy "allow_all_products"    on public.products           for all using (true) with check (true);
create policy "allow_all_exp"         on public.expiration_batches for all using (true) with check (true);
create policy "allow_all_transactions"on public.transactions       for all using (true) with check (true);


-- ============================================================
-- 5. SEED DATA — PRODUCTS (dari spreadsheet SEPTEMBER)
-- Urutan sesuai spreadsheet asli
-- ============================================================
insert into public.products (produk, ket_orderan, ket_barang, stock_awal, sisa_stok, urutan) values
('LE MINERALE GALON (15LTR)',                    'WEEKLY', 'USAGE',  29,  15,   1),
('GARAM DOLPHIN (500GR)',                         'WEEKLY', 'USAGE',   3,   1,   2),
('GULA PASIR (1 KG)',                             'WEEKLY', 'USAGE',   6,   4,   3),
('COCKTAIL NAPKIN ( 1 PACK ISI 100 PCS )',        '',       'USAGE', 144,   2,   4),
('HAND GLOVES KARET ( 1 PACK ISI 100 PCS )',      '',       'USAGE',  20,  11,   5),
('KANTONG PLASTIK XXI BESAR (1 PCK ISI 200 PCS)','',       'USAGE',   4,   4,   6),
('KANTONG PLASTIK XXI KECIL (1 PCK ISI 200 PCS)','',       'USAGE',   3,   3,   7),
('KERTAS PRINT HVS (1 PCK ISI 10 ROLL)',          '',       'USAGE',   0,   0,   8),
('KERTAS PRINT REGISTER ROLL (1 PCK/10 ROLL)',    '',       'USAGE',  16,  12,   9),
('PLASTIK KLIP 20X35 (100 PCS)',                  'WEEKLY', 'USAGE',   0,   0,  10),
('PLASTIK KLIP 30X40 (100 PCS)',                  'WEEKLY', 'USAGE',   1,   1,  11),
('PLASTIK KLIP 7X10 (1000 PCS)',                  '',       'USAGE',   2,   2,  12),
('PLASTIK KLIP 8X12 (1000 PCS)',                  '',       'USAGE',   0,   0,  13),
('PLASTIK KUE 15X20 (1000 GR)',                   '',       'USAGE',   2,   2,  14),
('KERTAS MINYAK XXI (100 PCS)',                   '',       'USAGE',   0,   0,  15),
('SEDOTAN BUBLE BROWN (250 PCS / PCK)',            '',       'USAGE',  20,  18,  16),
('SEDOTAN COKLAT ENVELOPE (500 PCS/PCK)',          '',       'USAGE',  17,  15,  17),
('SAUCE CUP 35 ML (1 PACK ISI 50 PCS)',            '',       'USAGE',  25,  25,  18),
('SLEEVE PAPER HOT CUP 8/12 OZ XXI (25 PCS)',     '',       'USAGE', 250,   9,  19),
('SLEEVE CUP ICED (50 PCS)',                       '',       'USAGE',   0,   0,  20),
('PLASTIK SEALING',                               '',       'USAGE',   0,   0,  21),
('PLASTIK ROLL BOBA 500 METER 1 WARNA',           '',       'USAGE',   0,   0,  22),
('SEDOTAN STIRER 17 CM BROWN (1000 PCS)',          '',       'USAGE',   0,   0,  23),
('SLEEVE PAPER PUCUK (50 PCS)',                    '',       'USAGE',   0,   0,  24),
('SLEEVE PAPER NIPIS MADU ( 50 PCS)',              '',       'USAGE',   0,   0,  25),
('TEA TONGJIE (100 PCS)',                         'WEEKLY', '',        50,  50,  26),
('KO-TE-SU RTD (24 CAN)',                         'WEEKLY', '',         0,   0,  27),
('MILAC GOLD (1000 GR)',                          'WEEKLY', '',         2,   1,  28),
('CONDENSED MILK (488 GR)',                       'WEEKLY', '',         0,   0,  29),
('CONDENSED MILK (365 GR)',                       'WEEKLY', '',         3,   0,  30),
('FRESH MILK (946 ML)',                           'WEEKLY', '',        79,  49,  31),
('OATSIDE MILK ( 1 LTR )',                        'WEEKLY', '',        47,  23,  32),
('NOBO ( 1 LTR )',                                'WEEKLY', 'KANTOR',  10,   7,  33),
('TORABIKA CAPPUCINO (120 PCS/ DUS)',             'WEEKLY', '',         0,   0,  34),
('SYRUP SOFT DRINK COCA-COLA (10 LTR)',           'WEEKLY', '',         4,   3,  35),
('SYRUP SOFT DRINK LEMON TEA (10 LTR)',           'WEEKLY', '',         5,   4,  36),
('SYRUP SOFT DRINK SPRITE ( 10 LTR)',             'WEEKLY', '',         0,   0,  37),
('SYRUP SOFT DRINK FANTA (10 LTR)',               'WEEKLY', '',         3,   1,  38),
('COCONUT WATER HIDRO COCO (500ML)',              'WEEKLY', 'KANTOR',   0,   0,  39),
('MINERAL WATER 600 ML (24 / DUS)',               'WEEKLY', '',        56,  42,  40),
('SYRUP NIPIS MADU (330 ML)',                     'WEEKLY', 'KANTOR',  20,  14,  41),
('THE PUCUK HARUM (350ML) LESS SUGAR',            'WEEKLY', '',         7,   7,  42),
('CREAM PUFF FROZEN (1 DUS=30 PCS)',              'WEEKLY', '',        54,  17,  43),
('MAYONASE (1 KG)',                               'WEEKLY', '',         3,   2,  44),
('SAUCE TAR TAR (0,5 KG)',                        'WEEKLY', '',         5,   5,  45),
('SAUCE RUJAK CIRENG (0,5 KG)',                   'WEEKLY', '',         1,   1,  46),
('SAUCE BATAGOR (0,5 KG)',                        'WEEKLY', '',         1,   0,  47),
('FRENCH FRIES (2, 271 GR)',                      'WEEKLY', '',        46,  28,  48),
('MINI WONTON (500 GR )',                         'WEEKLY', '',        80,  61,  49),
('SOSIS VIENNA (40 PCS/KG)',                      'WEEKLY', '',        17,   7,  50),
('SOSIS JAGDWURST (9 PCS/KG)',                    'WEEKLY', '',         2,   1,  51),
('SOSIS FRANKFURTER (16 PCS/KG)',                 'WEEKLY', '',         2,   2,  52),
('MAC N CHEESE (1 KG)',                           'WEEKLY', '',        14,  11,  53),
('CIRENG (1 KG)',                                 'WEEKLY', '',        10,   8,  54),
('BATAGOR (16 PCS)',                              'WEEKLY', '',        14,  12,  55),
('FISH N CHIPS (10 SINGLE/PCK)',                  'WEEKLY', '',         3,   2,  56),
('CHICKEN PATTY (1 KG)',                          'WEEKLY', '',        22,  21,  57),
('TEPUNG FISH (0,5 KG)',                          'WEEKLY', '',         5,   4,  58),
('TEPUNG MIX (0,5 KG)',                           'WEEKLY', '',         5,   4,  59),
('POCKY CHOCOLATE (10PCS/PCK)',                   'WEEKLY', '',         0,   0,  60),
('POCKY COOKIES N CREAM (10PCS/PCK)',             'WEEKLY', '',         4,   4,  61),
('BENG-BENG REGULER (17 PCS/PCK)',                'WEEKLY', '',         4,   4,  62),
('TANGO WAFEL (12 PCS/PCK)',                      'WEEKLY', '',         4,   4,  63),
('HELO PANDA (12 PCS/PCK)',                       'WEEKLY', '',         0,   0,  64),
('AMOS FRUIT GUMMY PEACH (36 PCS/DUS)',           'WEEKLY', '',        61,  60,  65),
('AMOS FRUIT GUMMY STRAWBERRY (36 PCS/DUS)',      'WEEKLY', '',        56,  46,  66),
('KOALA MARCH CHOCOLATE BOX (6 PCS/TRAY)',        'WEEKLY', 'KANTOR',   0,   0,  67),
('TONIC WATER (250 ML)',                          'WEEKLY', '',        26,  23,  68),
('FRUTA GUMMY 45 GR (1 DUS ISI 72 PCS)',          'WEEKLY', 'KANTOR',   6,   6,  69),
('BAKSO MENTAI LAVA ( 1 CRT = 8 PCK ISI )',       'WEEKLY', '',         2,   1,  70),
('BUMBU JAGUNG BAKAR ( 1 BTL 60 GR )',            'WEEKLY', '',         7,   7,  71),
('CHICKEN KARAGE ( 1 CRT ISI 5 PCK )',            'WEEKLY', '',         6,   4,  72),
('NATA JELLY CENDOL (500 GR)',                    'WEEKLY', '',         1,   1,  73),
('CINCAU TAWAR (500 GR)',                         'WEEKLY', '',         0,   0,  74),
('FRUTA GUMMY (13 PCS)',                          'WEEKLY', 'KANTOR',  14,  11,  75),
('HUNGRY BUT BUSY',                               'WEEKLY', '',       216,   4,  76),
('SUGAR SACHET',                                  '',       '',        -2,  -2,  77),
('POWDER COFFEE (120 GR) pcs',                    '',       '',        62,  52,  78),
('TEA BAG (50 PCS)',                              '',       '',        24,  20,  79),
('JASMINE GREEN TEA (200 GR)',                    '',       '',         5,   5,  80),
('GOOD TIME (72 GR)',                             '',       '',       112,  86,  81),
('LONGAN FRUIT CAN (565 GR)',                     '',       '',         7,   5,  82),
('KONJAC (1000 GR)',                              '',       '',         9,   9,  83),
('SELASIH (100 GR)',                              '',       '',        12,   9,  84),
('POWDER AVOCADO ( 500 GR )',                     '',       '',         4,   3,  85),
('MAX CRIMER ( 1 KG )',                           '',       '',        26,  19,  86),
('JELLY NATURAL ( 180 GR )',                      '',       '',        13,  11,  87),
('KKW (28 GR)',                                   '',       '',         0,   0,  88),
('KKW ( 38 GR )',                                 '',       '',       650, 650,  89),
('KKW ( 140 GR )',                                '',       '',         4,   1,  90),
('GRASS JELLY POWDER ( 1000 GR )',                '',       '',         4,   3,  91),
('MILO 3 IN 1 ( 990 GR )',                        '',       '',        25,  21,  92),
('CREAMY FOAM POWDER ( 1000 GR )',                '',       '',         4,   4,  93),
('POWDER JASMINE TEA ( 1 KG )',                   '',       '',         5,   4,  94),
('POWDER MATCHA ( 1 KG )',                        '',       '',        10,   7,  95),
('EARL GREY POWDER ( 1 KG )',                     '',       '',         5,   5,  96),
('KUNYIT ASAM POWDER (300 GR)',                   '',       'KANTOR',   6,   6,  97),
('COCOA DRINK POWDER PREMIX (1 KG)',              '',       'KANTOR',   4,   2,  98),
('SYRUP COKLAT DAVINCI ( 2 LTR )',                '',       '',         9,   9,  99),
('SYRUP COCONUT ( 1 LTR )',                       '',       '',         6,   5, 100),
('SYRUP KIWI MIX FRUITS ( 1 LTR ) ( BOTOL )',    '',       '',         3,   3, 101),
('SYRUP MONIN LYCHEE ( 1 LTR )',                  '',       '',        42,  36, 102),
('SYRUP WILD MINT ( 1 LTR ) ( BOTOL )',           '',       '',         2,   1, 103),
('SYRUP PANDAN ( 1 LTR )',                        '',       '',         9,   8, 104),
('SYRUP ABC LYCHEE (450 ML)',                     '',       '',        56,  41, 105),
('SYRUP MARJAN VANILLA (460 ML)',                 '',       '',        56,  42, 106),
('SYRUP BROWN SUGAR (1 LTR)',                     '',       '',         6,   6, 107),
('SYRUP STRAWBERRY MIX FRUIT (1 LTR) ( BOTOL )', '',       'KANTOR',   1,   1, 108),
('SYRUP BANANA (700 ML)',                         '',       'KANTOR',   3,   3, 109),
('MINYAK GORENG BEKU (15 KG)',                    '',       '',         6,   3, 110),
('MINYAK POPCORN (23.300 ML)',                    '',       '',        22,  18, 111),
('ORGANIC CRYSTAL COCONUT SUGAR (2,5 KG)',        '',       '',         4,   3, 112),
('SAUCE CHILLI (6 KG)',                           '',       '',        10,   7, 113),
('SAUCE TOMAT (5,7 KG)',                          '',       '',        12,  10, 114),
('SWEET GLAZE (13,5 KG/ DUS)',                    '',       '',        11,   8, 115),
('JAGUNG (22.680 GR)',                            '',       '',        19,  12, 116),
('NACHOS CHIPS (200 GR/PCK)',                     '',       '',         8,   5, 117),
('BULK CARAMEL (2,2 KG/PCK)',                     '',       '',        45,  37, 118),
('POPCORN CARAMEL TO-GO (50 PCS/DUS)',            '',       '',        44,  40, 119),
('BULK CHOCOLATE POPCORN (2,4 KG/PCK)',           '',       '',        25,  24, 120),
('HENRY SPELLBOOK BUCKET 85 OZ (1 CTN = 12 PCS)','',       '',        21,  21, 121),
('JAMES SIPPER CUP 22 0Z (1 CTN = 24 PCS)',       '',       '',        33,  33, 122),
('XXI BAG MEDIUM (50 PCS)',                       '',       '',       100, 100, 123),
('XXI BAG LARGE (50 PCS)',                        '',       '',        50,  50, 124),
('BAG POPCORN (50 PCS)',                          '',       '',        70,  54, 125),
('BUCKET POPCORN (100 PCS)',                      '',       '',       900, 700, 126),
('DUS POPCORN KIDS (50 PCS)',                     '',       '',        76,  30, 127),
('DUS POPCORN SMALL (50 PCS)',                    '',       '',        66,  30, 128),
('GELAS 12 OZ HOT CUP ( 25 PCS)',                '',       '',        10,  10, 129),
('GELAS 12 OZ PAPER XXI ( 50 PCS)',              '',       '',        93,  80, 130),
('GELAS 12 OZ OVAL (50 PCS)',                    '',       '',         6,   6, 131),
('GELAS 16 OZ PAPER XXI (50 PCS)',               '',       '',        33,  27, 132),
('GELAS 18 OZ PLASTIK CAPPUCINO (50 PCS)',       '',       '',        69,  60, 133),
('GELAS 16 OZ OVAL (50 PCS)',                    '',       '',        35,  32, 134),
('GELAS 22 OZ PAPER XXI (50 PCS)',               '',       '',        17,  12, 135),
('GELAS 8 OZ HOT CUP (25 PCS)',                  '',       '',        14,  12, 136),
('GELAS POPCORN CARAMEL 22 OZ (50 PCS)',         '',       '',        33,  23, 137),
('KERTAS MINYAK BURGER (100 PCS)',               '',       '',       200, 200, 138),
('LUNCH BOX (50 PCS)',                           '',       '',         1,   1, 139),
('PAPERBAG AP 2 WARNA (100 PCS)',                '',       '',         2,   1, 140),
('PAPERBAG ROTI SOSIS (50 PCS)',                 '',       '',         2,   1, 141),
('STIKER FINGER FOOD (1000 PCS)',                '',       '',         1,   0, 142),
('STIKER NACHOS (1000 PCS)',                     '',       '',       900, 900, 143),
('TRAY FISH N CHIPS + TUTUP (50 PCS)',           '',       '',       400, 350, 144),
('TRAY NACHOS + TUTUP (50 PCS)',                 '',       '',        50,   0, 145),
('TUTUP GELAS PAPER 12 OZ (50 PCS)',             '',       '',        83,  73, 146),
('TUTUP GELAS PAPER 16/22 OZ (50 PCSS)',         '',       '',        26,   6, 147),
('TUTUP LID CARAMEL 16/22 OZ (50 PCS)',          '',       '',        50,  47, 148),
('TUTUP LID DOME 12/18/22 OZ (50 PCS)',          '',       '',        60,  40, 149),
('TUTUP LID HOT 8/12 OZ (50 PCS)',               '',       '',         5,   5, 150),
('BOTOL PLASTIK 1000 ML + TUTUP + PRINTING',     '',       '',        16,  16, 151),
('GELAS 22 OZ PLATIK XXI (50 PCS)',              '',       '',        26,  26, 152),
('CROFFLE SATCHEL PRINTING GOLD (100 PCS)',      '',       '',         2,   2, 153),
('BOX CROFFLE 6',                                '',       '',        82,  82, 154)
on conflict do nothing;


-- ============================================================
-- 6. SEED DATA — EXPIRATION BATCHES (dari spreadsheet)
-- ============================================================
insert into public.expiration_batches (id, produk, exp_date, qty_awal, qty_tersisa, created_at) values
('EXP-000001', 'CONTOH PRODUK',                            '2026-09-27', 10,  10, '2026-08-28 05:22:51+00'),
('EXP-000002', 'BULK CARAMEL (2,2 KG/PCK)',                '2026-12-18', 10,   0, '2026-08-28 23:18:11+00'),
('EXP-000003', 'BULK CHOCOLATE POPCORN (2,4 KG/PCK)',      '2026-12-19',  5,   4, '2026-08-28 23:19:54+00'),
('EXP-000004', 'LE MINERALE GALON (15LTR)',                '2028-02-01',  5,   0, '2026-09-03 12:59:27+00'),
('EXP-000005', 'FISH N CHIPS (10 SINGLE/PCK)',             '2026-09-25',  1,   0, '2026-09-04 01:35:47+00'),
('EXP-000006', 'TEPUNG FISH (0,5 KG)',                     '2026-10-11',  4,   3, '2026-09-04 01:37:17+00'),
('EXP-000007', 'TEPUNG MIX (0,5 KG)',                      '2026-10-11',  3,   2, '2026-09-04 01:38:12+00'),
('EXP-000008', 'FRENCH FRIES (2, 271 GR)',                 '2028-06-02', 18,   2, '2026-09-04 01:45:03+00'),
('EXP-000009', 'SOSIS VIENNA (40 PCS/KG)',                 '2027-02-27', 14,   7, '2026-09-04 01:46:11+00'),
('EXP-000010', 'FRESH MILK (946 ML)',                      '2026-10-07', 24,   0, '2026-09-04 01:47:45+00'),
('EXP-000011', 'OATSIDE MILK ( 1 LTR )',                   '2027-07-31', 12,   0, '2026-09-04 01:48:48+00'),
('EXP-000012', 'SOSIS JAGDWURST (9 PCS/KG)',               '2027-02-22',  1,   1, '2026-09-04 01:50:01+00'),
('EXP-000013', 'MILAC GOLD (1000 GR)',                     '2027-03-11',  1,   0, '2026-09-04 01:51:10+00'),
('EXP-000014', 'CONDENSED MILK (365 GR)',                  '2027-05-01',  3,   0, '2026-09-04 01:51:48+00'),
('EXP-000015', 'GULA PASIR (1 KG)',                        '2028-07-18',  2,   0, '2026-09-04 01:53:02+00'),
('EXP-000016', 'GARAM DOLPHIN (500GR)',                    '2031-06-01',  2,   0, '2026-09-04 01:54:03+00'),
('EXP-000017', 'MAYONASE (1 KG)',                          '2028-01-25',  1,   0, '2026-09-04 01:54:45+00'),
('EXP-000018', 'COCOA DRINK POWDER PREMIX (1 KG)',         '2026-09-19',  2,   2, '2026-09-06 15:46:34+00'),
('EXP-000019', 'GARAM POPCORN (22.700 GR)',                '2027-06-24',  1,   1, '2026-09-07 14:37:01+00'),
('EXP-000020', 'SYRUP KIWI MIX FRUITS ( 1 LTR ) ( BOTOL )','2027-08-10', 1,   1, '2026-09-07 14:38:25+00'),
('EXP-000021', 'SYRUP STRAWBERRY MIX FRUIT (1 LTR) ( BOTOL )','2026-11-04',1, 1, '2026-09-07 14:40:08+00'),
('EXP-000022', 'FRUTA GUMMY (13 PCS)',                     '2027-02-01', 14,  11, '2026-09-07 15:55:28+00'),
('EXP-000023', 'SYRUP SOFT DRINK LEMON TEA (10 LTR)',      '2026-12-05',  1,   0, '2026-09-07 18:33:55+00'),
('EXP-000024', 'SYRUP SOFT DRINK COCA-COLA (10 LTR)',      '2026-10-07',  1,   0, '2026-09-07 18:34:51+00')
on conflict do nothing;
