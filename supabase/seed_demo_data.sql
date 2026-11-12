-- ====================================================================
-- ARTISAN CONNECT AI — ISOLATED DEMO DATA SEED SCRIPT
-- Strictly isolated with is_demo = TRUE to protect real marketplace data
-- ====================================================================

-- 1. Demo Products
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Channapatna Wooden Rocking Horse', 'ಚನ್ನಪಟ್ಟಣ ಮರದ ಆಟಿಕೆ ಕುದುರೆ', 'Traditional eco-friendly wooden rocking horse made with seasoned ivory wood and coated with natural vegetable lacquer dyes. Safe for children, durable, and polished with non-toxic lac.', 'ನೈಸರ್ಗಿಕ ತರಕಾರಿ ಬಣ್ಣಗಳಿಂದ ತಯಾರಿಸಿದ ಸಾಂಪ್ರದಾಯಿಕ ಚನ್ನಪಟ್ಟಣ ಮರದ ಕುದುರೆ ಆಟಿಕೆ. ಮಕ್ಕಳಿಗೆ ಸುರಕ್ಷಿತ ಮತ್ತು ಪರಿಸರಸ್ನೇಹಿ.', 850, 25, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Bidriware Silver Inlaid Floral Vase', 'ಬಿದ್ರಿ ಕಲೆಯ ಬೆಳ್ಳಿಯ ಹೂದಾನಿ', 'Authentic Bidri craft vase made from an alloy of zinc and copper with pure silver wire inlay depicting traditional Mughal floral motifs, blackened using soil from the Bidar fort.', 'ಶುದ್ಧ ಬೆಳ್ಳಿಯ ಕಸೂತಿ ಕೆಲಸವಿರುವ ಬಿದ್ರಿ ಕಲಾತ್ಮಕ ಹೂದಾನಿ. ಸತು ಮತ್ತು ತಾಮ್ರದ ಮಿಶ್ರಲೋಹದಿಂದ ತಯಾರಿಸಿದ ಪರಂಪರೆ ಕಲೆ.', 2800, 12, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Mysore Pure Silk Zari Saree', 'ಮೈಸೂರು ರೇಷ್ಮೆ ಜರಿ ಸೀರೆ', 'Handwoven Mysore pure mulberry silk saree featuring 100% pure gold zari border and rich pallu. Light in weight, smooth texture, and timeless elegance for special celebrations.', 'ಶುದ್ಧ ಮೈಸೂರು ಮಲ್ಬರಿ ರೇಷ್ಮೆ ಮತ್ತು ಶುದ್ಧ ಜರಿ ಬಾರ್ಡರ್ ಹೊಂದಿರುವ ಕೈಮಗ್ಗದ ಸೀರೆ. ನಯವಾದ ವಿನ್ಯಾಸ ಮತ್ತು ಸಾಂಪ್ರದಾಯಿಕ ಕಳೆ.', 4500, 10, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Terracotta Earthen Water Pot with Lid', 'ಮಣ್ಣಿನ ತಣ್ಣೀರಿನ ಮಡಕೆ ಮುಚ್ಚಳದೊಂದಿಗೆ', 'Natural clay water pot thrown on a traditional potter''s wheel and fired in an open wood kiln. Keeps drinking water naturally cool while infusing essential minerals.', 'ನೈಸರ್ಗಿಕ ಜೇಡಿಮಣ್ಣಿನಿಂದ ಕೈಯಿಂದ ಮಾಡಿದ ತಣ್ಣೀರಿನ ಮಡಕೆ. ನೈಸರ್ಗಿಕ ತಂಪು ನೀಡುತ್ತದೆ.', 450, 40, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Handcrafted Bamboo Storage Laundry Basket', 'ಕೈಯಿಂದ ಹೆಣೆದ ನೈಸರ್ಗಿಕ ಬಿದಿರಿನ ಬುಟ್ಟಿ', 'Eco-friendly handwoven bamboo utility basket with integrated handles. Treated naturally against moisture and termites, ideal for laundry, craft storage, or fruits.', 'ನೈಸರ್ಗಿಕ ಬಿದಿರಿನ ಪಟ್ಟಿಗಳಿಂದ ಗಟ್ಟಿಯಾಗಿ ಹೆಣೆದ ಬುಟ್ಟಿ. ಬಟ್ಟೆ ಅಥವಾ ಹಣ್ಣು ತರಕಾರಿ ಶೇಖರಣೆಗೆ ಸೂಕ್ತ.', 650, 30, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Sandalwood Carved Ganesha Idol', 'ಶ್ರೀಗಂಧದ ಕೆತ್ತನೆಯ ಗಣೇಶನ ಮೂರ್ತಿ', 'Exquisitely hand-carved Mysore sandalwood Ganesha miniature statue featuring fine micro-carvings and retained natural aromatic scent.', 'ಸುಗಂಧಭರಿತ ಅಸಲಿ ಶ್ರೀಗಂಧದ ಮರದಲ್ಲಿ ಸೂಕ್ಷ್ಮವಾಗಿ ಕೆತ್ತಲಾದ ಗಣೇಶ ಮೂರ್ತಿ.', 3200, 8, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Kasuti Hand Embroidery Cushion Cover Set', 'ಕಸೂತಿ ಕಸೂತಿ ಕಲೆಯ ದಿಂಬಿನ ಕವರ್ ಜೋಡಿ', 'Set of two pure cotton handloom cushion covers adorned with traditional North Karnataka Kasuti needlework featuring Gopura and peacock patterns.', 'ಉತ್ತರ ಕರ್ನಾಟಕದ ಸಾಂಪ್ರದಾಯಿಕ ಕಸೂತಿ ಕಲೆಯ ಕೈಕಸೂತಿ ಕೆಲಸವಿರುವ ಶುದ್ಧ ಹತ್ತಿ ದಿಂಬಿನ ಹೊದಿಕೆಗಳು.', 950, 18, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Brass Traditional Temple Diya Hanging Lamp', 'ಹಿತ್ತಾಳೆಯ ತೂಗು ದೀಪ (ಆರತಿ ದೀಪ)', 'Solid brass hanging lamp crafted using ancient lost-wax casting technique. Features chain links and an ornate peacock crest for puja rooms and festive lighting.', 'ಸಾಂಪ್ರದಾಯಿಕ ಹಿತ್ತಾಳೆ ಎರಕಹೊಯ್ದ ತೂಗು ದೀಪ. ಪೂಜಾ ಕೋಣೆಗೆ ಮತ್ತು ಹಬ್ಬಗಳಿಗೆ ಪ್ರಶಸ್ತ.', 1450, 15, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Terracotta Hand-Painted Clay Wall Hanging Plates', 'ಮಣ್ಣಿನ ಕೈಬಣ್ಣದ ಅಲಂಕಾರಿಕ ಗೋಡೆ ತಟ್ಟೆ', 'Artisan terracotta round wall hanging plate painted with earthy tribal motifs using water-resistant organic pigments.', 'ಗೋಡೆಗೆ ಹಾಕಲು ಮಣ್ಣಿನ ಕೈಬಣ್ಣದ ಸುಂದರ ಕಲಾತ್ಮಕ ಅಲಂಕಾರಿಕ ತಟ್ಟೆ.', 550, 22, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Kinnal Wooden Painted Cow & Calf Figurine', 'ಕಿನ್ನಾಳ ಕಲೆಯ ಕಾಮಧೇನು ಮರದ ಗೊಂಬೆ', 'Famous GI-tagged Kinnal woodcraft idol made with softwood paste and decorated with vibrant natural colors and rich gold leaf foil embossing.', 'ಕಿನ್ನಾಳ ಕಲೆಯ ಬಣ್ಣದ ಕಾಮಧೇನು ಗೋವು ಮತ್ತು ಕರುವಿನ ವಿಗ್ರಹ.', 1800, 9, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Handmade Clay Chai Kulhar Cups (Set of 6)', 'ಮಣ್ಣಿನ ಕುಲ್ಹಡ್ ಚಹಾ ಕಪ್‌ಗಳು (೬ ರ ಸೆಟ್)', 'Unglazad terracotta clay chai cups for traditional aromatic Indian masala tea. 100% natural, biodegradable, and reusable.', 'ಸಾಂಪ್ರದಾಯಿಕ ಮಣ್ಣಿನ ಚಹಾ ಕುಲ್ಹಡ್ ಲೋಟಗಳು (೬ ರ ಸೆಟ್). ನೈಸರ್ಗಿಕ ಸುವಾಸನೆ ನೀಡುತ್ತದೆ.', 380, 50, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Terracotta Ceramic Glazed Stud Earrings', 'ಮಣ್ಣಿನ ಕಲಾತ್ಮಕ ಕಿವಿಯೋಲೆಗಳು', 'Lightweight terracotta clay baked and hand-painted with ceramic glaze and hypoallergenic silver studs.', 'ಜೇಡಿಮಣ್ಣಿನಿಂದ ಕೈಯಿಂದ ತಯಾರಿಸಿ ಬಣ್ಣ ಹಚ್ಚಿದ ಹಗುರವಾದ ಕಿವಿಯೋಲೆಗಳು.', 320, 35, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Handmade Jute Floor Mat Runner', 'ನೈಸರ್ಗಿಕ ಗೋಣಿ ನಾರಿನ ನೆಲಹಾಸು', 'Braided golden jute floor mat runner for living rooms and entryways. Strong, sustainable, and biodegradable.', 'ನೈಸರ್ಗಿಕ ಸೆಣಬಿನ ನಾರಿನಿಂದ ಹೆಣೆದ ಗಟ್ಟಿಮುಟ್ಟಾದ ನೆಲಹಾಸು.', 720, 20, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Ilkal Pure Cotton Handloom Saree', 'ಇಳಕಲ್ ಹತ್ತಿ ಕೈಮಗ್ಗ ಸೀರೆ', 'Traditional Ilkal cotton handloom saree with classic red Chikki paras border and distinctive Tope Teni pallu.', 'ಟೋಪೆ ತೇನಿ ಪಲ್ಲು ಮತ್ತು ಚಿಕ್ಕಿ ಪಾರಸ್ ಬಾರ್ಡರ್ ಹೊಂದಿರುವ ಪ್ರಸಿದ್ಧ ಇಳಕಲ್ ಕೈಮಗ್ಗ ಸೀರೆ.', 2200, 14, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Channapatna Wooden Stacking Educational Toy Rings', 'ಚನ್ನಪಟ್ಟಣ ಮರದ ರಿಂಗ್ ಜೋಡಣೆ ಆಟಿಕೆ', 'Seven colorful polished wooden stacking rings made of hale wood and vegetable dyes to promote motor skills in toddlers.', 'ಮಕ್ಕಳ ಕೌಶಲ್ಯ ಬೆಳವಣಿಗೆಗೆ ಸುರಕ್ಷಿತ ಚನ್ನಪಟ್ಟಣ ಮರದ ಬಣ್ಣದ ರಿಂಗ್ ಆಟಿಕೆ.', 490, 30, 'published', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, local_title, description, local_description, price, stock_quantity, status, is_demo)
VALUES ('Bronze Cast Dhokra Tribal Musician Figurine', 'ಡೋಕ್ರಾ ಬುಡಕಟ್ಟು ಕಂಚಿನ ಸಂಗೀತಗಾರ ಮೂರ್ತಿ', 'Ancient non-ferrous lost-wax metal casting idol representing traditional folk drummer in Dhokra tribal style.', 'ಕಂಚಿನ ಸಾಂಪ್ರದಾಯಿಕ ಡೋಕ್ರಾ ಕಲೆಯ ಬುಡಕಟ್ಟು ಸಂಗೀತಗಾರ ಮೂರ್ತಿ.', 1650, 11, 'published', TRUE)
ON CONFLICT DO NOTHING;

-- 2. Demo Orders
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1700, 'placed', 'not_started', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-05T08:30:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (450, 'placed', 'not_started', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-05T11:15:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (950, 'placed', 'not_started', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-05T14:40:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (2800, 'confirmed', 'material_selection', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-04T09:20:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1950, 'confirmed', 'material_selection', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-04T13:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (760, 'confirmed', 'material_selection', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-04T16:10:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1960, 'confirmed', 'material_selection', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-03T18:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (4500, 'preparing', 'crafting', '{"materials_ready":true,"crafting_started":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-03T10:15:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (3200, 'preparing', 'crafting', '{"materials_ready":true,"crafting_started":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-03T11:45:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (2900, 'preparing', 'finishing', '{"materials_ready":true,"crafting_started":true,"quality_inspection":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-02T14:10:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1800, 'preparing', 'finishing', '{"materials_ready":true,"crafting_started":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-02T16:30:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (2200, 'preparing', 'crafting', '{"materials_ready":true,"crafting_started":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-02T17:50:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (2550, 'ready_for_dispatch', 'packed', '{"materials_ready":true,"crafting_started":true,"quality_inspection":true,"protective_packaging":true,"address_labeled":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-01T09:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1300, 'ready_for_dispatch', 'packed', '{"materials_ready":true,"crafting_started":true,"quality_inspection":true,"protective_packaging":true,"address_labeled":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-01T12:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1600, 'ready_for_dispatch', 'packed', '{"materials_ready":true,"crafting_started":true,"quality_inspection":true,"protective_packaging":true,"address_labeled":true}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-11-01T15:30:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (2800, 'shipped', 'not_started', '{}'::jsonb, 'India Post Speed Post', 'EK783921045IN', '2026-10-31T10:00:00Z', NULL, TRUE, '2026-10-29T10:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (900, 'shipped', 'not_started', '{}'::jsonb, 'Delhivery Express', 'DEL39201948', '2026-10-31T12:00:00Z', NULL, TRUE, '2026-10-29T12:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1900, 'shipped', 'not_started', '{}'::jsonb, 'Blue Dart', 'BD44920119', '2026-10-30T16:00:00Z', NULL, TRUE, '2026-10-28T16:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (720, 'shipped', 'not_started', '{}'::jsonb, 'Professional Couriers', 'TPC8392010', '2026-10-30T11:00:00Z', NULL, TRUE, '2026-10-28T11:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1700, 'delivered', 'not_started', '{}'::jsonb, 'India Post Speed Post', 'EK619283741IN', '2026-10-25T09:00:00Z', '2026-10-28T14:30:00Z', TRUE, '2026-10-23T09:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (4500, 'delivered', 'not_started', '{}'::jsonb, 'Blue Dart Express', 'BD10293847', '2026-10-24T11:00:00Z', '2026-10-27T12:15:00Z', TRUE, '2026-10-22T11:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1450, 'delivered', 'not_started', '{}'::jsonb, 'Delhivery', 'DEL84729104', '2026-10-22T10:00:00Z', '2026-10-25T16:00:00Z', TRUE, '2026-10-20T10:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1140, 'delivered', 'not_started', '{}'::jsonb, 'India Post', 'EK192837465IN', '2026-10-20T14:00:00Z', '2026-10-23T11:00:00Z', TRUE, '2026-10-18T14:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (1650, 'delivered', 'not_started', '{}'::jsonb, 'DTDC Express', 'DTD74829103', '2026-10-18T15:00:00Z', '2026-10-21T13:45:00Z', TRUE, '2026-10-16T15:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO public.orders (total_amount, status, preparation_stage, preparation_checklist, carrier_name, tracking_number, dispatch_date, delivered_at, is_demo, created_at)
VALUES (450, 'cancelled', 'not_started', '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, '2026-10-20T08:00:00Z')
ON CONFLICT DO NOTHING;
