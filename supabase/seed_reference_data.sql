-- ECHO / REACH Encounter - non-production demo seed
-- Apply only after ECHO_REACH_Supabase_Migration.sql.
-- This seeds UI reference data visible in the supplied mockups.
-- It intentionally does NOT seed clinical triage thresholds or treatment guidance;
-- those require review and approval by the clinical governance owner.

insert into public.syndromes (code, label_en, label_ha, display_order)
values
  ('FEVER_RASH', 'Fever with rash', 'Zazzabi da kurji', 10),
  ('ACUTE_WATERY_DIARRHOEA', 'Acute watery diarrhoea', 'Gudawa mai ruwa-ruwa', 20),
  ('FEVER_BLEEDING', 'Fever with bleeding', 'Zazzabi da zubar jini', 30),
  ('FEVER_NECK_STIFFNESS', 'Fever with neck stiffness', 'Zazzabi da taurin wuya', 40),
  ('ACUTE_FLACCID_PARALYSIS', 'Acute flaccid paralysis', 'Sanyin kafa ko hannu na gaggawa', 50),
  ('ACUTE_RESPIRATORY_ILLNESS', 'Acute respiratory illness', 'Ciwon numfashi na gaggawa', 60),
  ('JAUNDICE', 'Jaundice', 'Ciwon shawara', 70),
  ('COUGH_OVER_TWO_WEEKS', 'Cough for more than two weeks', 'Tari na mako 2 ko fiye', 80),
  ('NEONATAL_DANGER_SIGNS', 'Neonatal danger signs', 'Alamomin hadari ga jariri', 90),
  ('OTHER_PRIORITY', 'Other priority syndrome', 'Sauran cututtuka masu mahimmanci', 100)
on conflict (code) do update set
  label_en = excluded.label_en,
  label_ha = excluded.label_ha,
  display_order = excluded.display_order,
  is_active = true;

with syndrome as (
  select id from public.syndromes where code = 'FEVER_RASH'
), inserted as (
  insert into public.question_sets (syndrome_id, version, status, effective_from)
  select id, 1, 'published', now() from syndrome
  on conflict (syndrome_id, version) do update set status = 'published'
  returning id
)
insert into public.questions
  (question_set_id, code, type, prompt_en, prompt_ha, display_order)
select inserted.id, q.code, 'boolean'::public.question_type, q.en, q.ha, q.ord
from inserted cross join (values
  ('HAS_COUGH', 'Does the patient have a cough?', 'Shin majiyyacin yana tari?', 10),
  ('HAS_RUNNY_NOSE', 'Does the patient have a runny nose?', 'Shin majiyyacin yana majina?', 20),
  ('HAS_RED_EYES', 'Are the patient''s eyes red?', 'Shin idanun majiyyacin sun yi ja?', 30),
  ('HAS_SWOLLEN_NODES', 'Are the lymph nodes swollen (neck or behind the ears)?', 'Shin akwai kumburi a wuya ko bayan kunne?', 40)
) as q(code, en, ha, ord)
on conflict (question_set_id, code) do update set
  prompt_en = excluded.prompt_en, prompt_ha = excluded.prompt_ha,
  display_order = excluded.display_order, is_active = true;

with syndrome as (
  select id from public.syndromes where code = 'ACUTE_WATERY_DIARRHOEA'
), inserted as (
  insert into public.question_sets (syndrome_id, version, status, effective_from)
  select id, 1, 'published', now() from syndrome
  on conflict (syndrome_id, version) do update set status = 'published'
  returning id
)
insert into public.questions
  (question_set_id, code, type, prompt_en, prompt_ha, display_order)
select inserted.id, q.code, q.kind::public.question_type, q.en, q.ha, q.ord
from inserted cross join (values
  ('IS_DEHYDRATED', 'boolean', 'Is the patient very thirsty or dehydrated?', 'Shin majiyyacin yana jin kishirwa sosai ko rashin ruwa a jiki?', 10),
  ('DEHYDRATION_SEVERITY', 'severity_0_10', 'How dehydrated or thirsty is the patient?', 'Yaya tsananin kishirwa ko rashin ruwa a jikin majiyyacin?', 20),
  ('MANY_EPISODES', 'boolean', 'Has the patient had many diarrhoea episodes today?', 'Shin majiyyacin ya yi gudawa sau da yawa a yau?', 30),
  ('DIARRHOEA_SEVERITY', 'severity_0_10', 'How watery is the diarrhoea?', 'Yaya ruwan gudawar yake?', 40)
) as q(code, kind, en, ha, ord)
on conflict (question_set_id, code) do update set
  type = excluded.type, prompt_en = excluded.prompt_en, prompt_ha = excluded.prompt_ha,
  display_order = excluded.display_order, is_active = true;

insert into public.lab_test_definitions (code, version, name_en, result_type)
values
  ('MALARIA_RDT', 1, 'Malaria RDT', 'binary'),
  ('HEPATITIS_B_SURFACE_AG_RDT', 1, 'Hepatitis B Surface Ag RDT', 'binary'),
  ('TYPHOID_SALMONELLA_IGG_IGM_RDT', 1, 'Typhoid/Salmonella IgG/IgM RDT', 'numeric'),
  ('URINALYSIS', 1, 'Urinalysis', 'multi_component'),
  ('RANDOM_BLOOD_SUGAR', 1, 'Random Blood Sugar', 'numeric'),
  ('URINE_PREGNANCY_TEST', 1, 'Urine Pregnancy Test', 'binary'),
  ('HIV_RDT', 1, 'HIV RDT', 'binary'),
  ('HEPATITIS_C_RDT', 1, 'Hepatitis C RDT', 'binary'),
  ('H_PYLORI_STOOL_AG_RDT', 1, 'H. pylori Stool Ag RDT', 'binary')
on conflict (code, version) do update set
  name_en = excluded.name_en, result_type = excluded.result_type, is_active = true;

with urinalysis as (
  select id from public.lab_test_definitions where code = 'URINALYSIS' and version = 1
)
insert into public.lab_test_components
  (lab_test_definition_id, code, label_en, result_type, unit, reference_range, options, display_order)
select urinalysis.id, c.code, c.label, c.kind::public.lab_result_type, c.unit,
  c.range::jsonb, c.options::jsonb, c.ord
from urinalysis cross join (values
  ('COLOUR', 'Colour', 'single_select', null, '{}', '["pale_yellow","yellow","amber","other"]', 10),
  ('CLARITY', 'Clarity', 'single_select', null, '{}', '["clear","slightly_cloudy","cloudy"]', 20),
  ('BLOOD', 'Blood', 'binary', null, '{}', '["negative","positive"]', 30),
  ('UROBILINOGEN', 'Urobilinogen', 'numeric', 'umol/L', '{"min":0.1,"max":1.0}', '[]', 40),
  ('KETONE', 'Ketone', 'binary', null, '{}', '["negative","positive"]', 50),
  ('GLUCOSE', 'Glucose', 'binary', null, '{}', '["negative","positive"]', 60),
  ('PROTEIN', 'Protein', 'binary', null, '{}', '["negative","positive"]', 70)
) as c(code, label, kind, unit, range, options, ord)
on conflict (lab_test_definition_id, code) do update set
  label_en = excluded.label_en, result_type = excluded.result_type,
  unit = excluded.unit, reference_range = excluded.reference_range,
  options = excluded.options, display_order = excluded.display_order;

-- Before production:
-- 1. Clinically review every English/Hausa term and attach approved audio.
-- 2. Add versioned consent text.
-- 3. Add approved triage_rules; do not derive them from mockup sample copy.
-- 4. Add the organization, facilities and staff memberships through an audited admin flow.
