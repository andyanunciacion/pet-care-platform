-- Starting taxonomy: species and service categories (with search synonyms, including
-- Filipino terms). Later changes are made in /admin, or in a new migration until then.
-- Synonyms are lowercase; search lowercases the query before matching.
INSERT INTO species (code, name, sort_order) VALUES
  ('dog', 'Dog', 1),
  ('cat', 'Cat', 2),
  ('rabbit', 'Rabbit', 3),
  ('small_mammal', 'Small mammals', 4),
  ('bird', 'Birds', 5),
  ('reptile', 'Reptiles', 6),
  ('fish', 'Fish', 7),
  ('poultry', 'Poultry', 8),
  ('livestock', 'Livestock', 9);
--> statement-breakpoint
-- Groups: top-level categories. Services use the categories nested under them.
INSERT INTO service_category (code, name, sort_order) VALUES
  ('checkups', 'Check-ups', 1),
  ('preventive_care', 'Preventive care', 2),
  ('surgery', 'Surgery', 3),
  ('diagnostics', 'Diagnostics', 4),
  ('hospital_care', 'Hospital care', 5),
  ('grooming_boarding', 'Grooming & boarding', 6);
--> statement-breakpoint
INSERT INTO service_category (code, name, parent_id, synonyms, sort_order)
SELECT category.code, category.name, parent.id, category.synonyms, category.sort_order
FROM (VALUES
  ('consultation', 'Consultation', 'checkups',
    ARRAY['check-up', 'checkup', 'check up', 'konsulta', 'patingin'], 1),
  ('health_certificate', 'Health certificate', 'checkups',
    ARRAY['health cert', 'travel certificate', 'vet certificate', 'shipping'], 2),
  ('vaccination', 'Vaccination', 'preventive_care',
    ARRAY['bakuna', 'vaccine', 'anti-rabies', 'anti rabies', '5-in-1', '6-in-1', '8-in-1', '4-in-1'], 1),
  ('deworming', 'Deworming', 'preventive_care',
    ARRAY['purga', 'pampurga', 'deworm'], 2),
  ('tick_flea', 'Tick & flea control', 'preventive_care',
    ARRAY['garapata', 'pulgas', 'kuto', 'tick', 'flea'], 3),
  ('spay_neuter', 'Spay / neuter', 'surgery',
    ARRAY['kapon', 'castration', 'ligate', 'ligation', 'spay', 'neuter'], 1),
  ('general_surgery', 'General surgery', 'surgery',
    ARRAY['opera', 'operasyon', 'surgery'], 2),
  ('dental', 'Dental care', 'surgery',
    ARRAY['dental cleaning', 'scaling', 'prophylaxis', 'ngipin'], 3),
  ('laboratory', 'Laboratory tests', 'diagnostics',
    ARRAY['blood test', 'cbc', 'urinalysis', 'ihi', 'fecalysis', 'dumi', 'test kit', 'parvo test'], 1),
  ('imaging', 'X-ray & ultrasound', 'diagnostics',
    ARRAY['x-ray', 'xray', 'ultrasound'], 2),
  ('confinement', 'Confinement', 'hospital_care',
    ARRAY['confine', 'admit', 'hospitalization', 'swero', 'dextrose'], 1),
  ('euthanasia', 'Euthanasia', 'hospital_care',
    ARRAY['put to sleep'], 2),
  ('grooming', 'Grooming', 'grooming_boarding',
    ARRAY['paligo', 'ligo', 'gupit', 'haircut', 'nail trim', 'groom'], 1),
  ('boarding', 'Boarding', 'grooming_boarding',
    ARRAY['pet hotel', 'iwan', 'bantay', 'pet sitting'], 2)
) AS category (code, name, parent_code, synonyms, sort_order)
JOIN service_category AS parent ON parent.code = category.parent_code;
