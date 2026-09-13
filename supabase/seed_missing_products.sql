-- ============================================================
-- SEED: Produk yang belum masuk dari list 189
-- Jalankan di Supabase SQL Editor
-- Sudah ada di schema.sql (urutan 1-154):
--   semua produk dari LE MINERALE s/d BOX CROFFLE 6
-- ============================================================

insert into public.products (produk, ket_orderan, ket_barang, stock_awal, sisa_stok, urutan) values

-- Stok 0 yang terlewat (tidak ada di schema.sql)
('CREAM CHARGES',                                '', '',        0,   0, 155),
('ALOE VERA (2 KG)',                             '', '',        0,   0, 156),
('COCONUT CRISPY (500 GR)',                      '', '',        0,   0, 157),
('OREO COOKIES CRUMB (1 KG )',                   '', '',        0,   0, 158),
('JAVA TEA PREMIX POWDER',                       '', '',        0,   0, 159),
('SYRUP KONSENTRAT LEMON',                       '', '',        0,   0, 160),
('SYRUP PEACH (700 ML)',                         '', '',        0,   0, 161),
('COCA-COLA PET (250 ML)',                       '', '',        0,   0, 162),
('SYRUP DVG MANGO FRUIT MIX (1 LTR)',            '', '',        0,   0, 163),
('SYRUP BLUE LAGOON (700 ML)',                   '', '',        0,   0, 164),
('SYRUP OSMANTUS (760 GR)',                      '', 'KANTOR',  0,   0, 165),
('GRAPE SAUCE (1000 ML) ( BOTOL )',              '', 'KANTOR',  0,   0, 166),
('SYRUP RASPBERRY FRUIT MIX (1 LTR) ( BOTOL )', '', 'KANTOR',  0,   0, 167),
('CROFFLE ORIGINAL MINI ( 6 PCS/PCK)',           '', '',        0,   0, 168),
('CROFFLE ORIGINAL (4 PCS/ PCK)',                '', '',        0,   0, 169),
('CROFFLE NUTELL (4 PCS/ PCK)',                  '', '',        0,   0, 170),
('CROFFLE NUTELLA MINI ( 6 PCS/PCK)',            '', '',        0,   0, 171),
('PRETZEL CREAM CHEESE ( 6 PCS /PCK)',           '', '',        0,   0, 172),
('CHEESE NACHOS (3.970 GR)',                     '', '',        0,   0, 173),
('HONEY/MADU',                                  '', '',        0,   0, 174),
('JALAPENO',                                    '', '',        0,   0, 175),
('BULK BALADO POPCORN (1,8 KG/PCK)',             '', '',        0,   0, 176),
('BULK TOFFEE NUT POPCORN (2,4 KG/PCK)',         '', '',        0,   0, 177),
('CHUPA CHUPS ( 1 CTN 8 X 16 = 128 )',          '', 'kantor',  0,   0, 178),
('AGENDA BOX ( 1 CTN = 10 PCS)',                '', '',        0,   0, 179),
('GELAS 12 OZ PLASTIK CAPPUCINO (50 PCS)',       '', '',        0,   0, 180),
('GELAS POPCORN CARAMEL 16 OZ (50 PCS)',         '', '',        0,   0, 181),
('LID BUCKET POPCORN (100 PCS)',                 '', '',        0,   0, 182),
('TUTUP GELAS PAPER 16/22 OZ (100 PCS)',         '', '',        0,   0, 183),
('DUS POPCORN JUMBO GREEN (150 PCS)',            '', '',        0,   0, 184),
('TERMOL BAG (25 PCS)',                          '', '',        0,   0, 185),

-- Ada di list tapi TIDAK ada di schema.sql (punya sisa stok)
('BUTTER POPCORN (3.790 ML)',                    '', '',        1,   0, 186),
('GARAM POPCORN (22.700 GR)',                    '', '',        2,   1, 187)

on conflict do nothing;

-- CATATAN:
-- Produk berikut SUDAH ADA di schema.sql, tidak perlu diinsert:
-- SYRUP COCONUT (urutan 100), SYRUP WILD MINT (103), KKW (28 GR) (88)
-- Total setelah ini: 187 produk
-- 2 produk sisanya kemungkinan ada dengan nama sedikit beda di database.
-- Cek via: SELECT produk FROM products ORDER BY urutan;
