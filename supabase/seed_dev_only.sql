-- ECHO / REACH Encounter - LOCAL DEVELOPMENT ONLY seed data.
-- This file is intentionally separate from seed_reference_data.sql.
--
-- It seeds:
--   1. A demo organization and two facilities (source + referral destination)
--      so the app is usable end to end on a fresh local database.
--   2. Versioned consent text (English/Hausa) for anonymous and identified
--      screening -- placeholder copy only, NOT reviewed legal/consent
--      language. Replace before any real use.
--   3. Example triage rules for two syndromes and an example incentive
--      rule, clearly marked as demo content per the PRD ("Examples in the
--      design ... are demo content only. Clinical admins must approve
--      production wording, thresholds and treatment guidance.").
--
-- DO NOT apply this file to a production or staging project. It is only
-- referenced from supabase/config.toml's [db.seed] block, which is only
-- consulted by `supabase db reset` / local development.

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Demo Health Organization', 'demo-health-org')
on conflict (id) do nothing;

insert into public.facilities (id, organization_id, name, code, facility_type, is_active)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Demo Primary Health Centre', 'PHC-DEMO', 'primary_health_centre', true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Demo General Hospital', 'GH-DEMO', 'general_hospital', true)
on conflict (id) do nothing;

-- After creating your first user via Supabase Auth (sign up through the app,
-- or `supabase auth admin` / Studio), link it to a facility with:
--
--   insert into public.profiles (id, display_name)
--   values ('<auth-user-uuid>', 'Demo Clinician')
--   on conflict (id) do update set display_name = excluded.display_name;
--
--   insert into public.facility_memberships (user_id, organization_id, facility_id, role)
--   values ('<auth-user-uuid>', '00000000-0000-0000-0000-000000000001',
--           '00000000-0000-0000-0000-000000000010', 'clinician');
--
-- See README.md for the full local setup walkthrough.

insert into public.consent_text_versions (kind, version, text_en, text_ha, effective_from)
values
  ('anonymous_screening', 1,
   'DEMO CONSENT TEXT (not legally reviewed): I will ask you some questions about your symptoms to help identify possible outbreaks in the community. Your answers will not be linked to your name, phone number or any other identifying information.',
   'RUBUTUN YARDA NA GWAJI (ba a bincika ta hanyar shari''a ba): Zan yi maka wasu tambayoyi game da alamomin cutar don gano yiwuwar annoba a cikin al''umma. Ba za a hada amsoshinka da suna, lambar waya ko wani abu da za a gane ka da shi ba.',
   now()),
  ('identified_screening', 1,
   'DEMO CONSENT TEXT (not legally reviewed): We would like to collect your name and contact details so we can coordinate your care with the facility you are being referred to. This information will only be shared with that facility.',
   'RUBUTUN YARDA NA GWAJI (ba a bincika ta hanyar shari''a ba): Muna so mu tattara sunanka da hanyar tuntubarka domin mu tsara kula da lafiyarka tare da wurin da za a mika ka. Za a raba wannan bayanin ne kawai da wurin da aka mika ka.',
   now()),
  ('identified_referral', 1,
   'DEMO CONSENT TEXT (not legally reviewed): By continuing, you agree that your health information may be shared with the destination facility for the purpose of your referral and follow-up care.',
   'RUBUTUN YARDA NA GWAJI (ba a bincika ta hanyar shari''a ba): Ta hanyar ci gaba, ka yarda cewa za a iya raba bayanan lafiyarka da wurin da aka mika ka domin dalilin mikawa da kula da kai.',
   now())
on conflict (kind, version) do update set
  text_en = excluded.text_en, text_ha = excluded.text_ha, effective_from = excluded.effective_from;

-- Example triage rules (DEMO ONLY -- not clinically reviewed or approved).
with syndrome as (
  select id from public.syndromes where code = 'ACUTE_WATERY_DIARRHOEA'
)
insert into public.triage_rules (
  syndrome_id, version, status, priority, condition_code, condition_label_en, condition_label_ha,
  severity, conditions, guidance_en, guidance_ha, ipc_guidance_en, ipc_guidance_ha,
  referral_required, effective_from
)
select syndrome.id, 1, 'published', 10, 'SUSPECTED_CHOLERA_DEMO',
  'Suspected cholera (demo)', 'Ana zargin kwalara (gwaji)',
  'emergency',
  '[{"question_code":"IS_DEHYDRATED","op":"is_true"},{"question_code":"MANY_EPISODES","op":"is_true"}]'::jsonb,
  'DEMO GUIDANCE: Refer immediately for IV rehydration and cholera investigation.',
  'JAGORAR GWAJI: A mika nan take domin ba da ruwa ta jijiya da bincike na kwalara.',
  'DEMO IPC: Isolate the patient, use ORS preparation precautions, notify facility IPC lead.',
  'JAGORAR IPC TA GWAJI: A kebe majiyyaci, a yi hankali wajen shirya ORS, a sanar da shugaban IPC.',
  true, now()
from syndrome
on conflict (syndrome_id, version, condition_code) do update set
  priority = excluded.priority, severity = excluded.severity, conditions = excluded.conditions,
  guidance_en = excluded.guidance_en, guidance_ha = excluded.guidance_ha,
  ipc_guidance_en = excluded.ipc_guidance_en, ipc_guidance_ha = excluded.ipc_guidance_ha,
  referral_required = excluded.referral_required, status = 'published';

with syndrome as (
  select id from public.syndromes where code = 'ACUTE_WATERY_DIARRHOEA'
)
insert into public.triage_rules (
  syndrome_id, version, status, priority, condition_code, condition_label_en, condition_label_ha,
  severity, conditions, guidance_en, guidance_ha, referral_required, effective_from
)
select syndrome.id, 1, 'published', 0, 'MILD_DIARRHOEA_DEMO',
  'Mild acute watery diarrhoea (demo)', 'Gudawa mai ruwa-ruwa mara tsanani (gwaji)',
  'routine',
  '[{"question_code":"MANY_EPISODES","op":"answered"}]'::jsonb,
  'DEMO GUIDANCE: Advise oral rehydration salts and food/water hygiene; review in 48 hours if not improving.',
  'JAGORAR GWAJI: A shawarci amfani da ORS da tsaftar abinci/ruwa; a duba bayan sa''o''i 48 idan bai inganta ba.',
  false, now()
from syndrome
on conflict (syndrome_id, version, condition_code) do update set
  priority = excluded.priority, severity = excluded.severity, conditions = excluded.conditions,
  guidance_en = excluded.guidance_en, guidance_ha = excluded.guidance_ha,
  referral_required = excluded.referral_required, status = 'published';

with syndrome as (
  select id from public.syndromes where code = 'FEVER_RASH'
)
insert into public.triage_rules (
  syndrome_id, version, status, priority, condition_code, condition_label_en, condition_label_ha,
  severity, conditions, guidance_en, guidance_ha, referral_required, effective_from
)
select syndrome.id, 1, 'published', 5, 'FEVER_RASH_URGENT_DEMO',
  'Fever with rash and swollen nodes (demo)', 'Zazzabi da kurji da kumburi (gwaji)',
  'urgent',
  '[{"question_code":"HAS_SWOLLEN_NODES","op":"is_true"},{"question_code":"HAS_RED_EYES","op":"is_true"}]'::jsonb,
  'DEMO GUIDANCE: Urgent clinical review recommended; consider measles/rubella surveillance protocol.',
  'JAGORAR GWAJI: An shawarci bincike na gaggawa; a lura da yiwuwar ciwon kyanda/rubella.',
  true, now()
from syndrome
on conflict (syndrome_id, version, condition_code) do update set
  priority = excluded.priority, severity = excluded.severity, conditions = excluded.conditions,
  guidance_en = excluded.guidance_en, guidance_ha = excluded.guidance_ha,
  referral_required = excluded.referral_required, status = 'published';

-- Example incentive rule: eligible if closed within 72 hours of creation.
insert into public.incentive_rules (organization_id, version, name, conditions, status, effective_from)
values (
  '00000000-0000-0000-0000-000000000001', 1, 'Closure within 72 hours (demo)',
  '{"max_closure_seconds": 259200}'::jsonb,
  'published', now()
)
on conflict (organization_id, version) do update set
  name = excluded.name, conditions = excluded.conditions, status = 'published';
