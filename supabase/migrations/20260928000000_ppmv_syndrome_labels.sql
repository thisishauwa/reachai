-- Migration: Update syndrome labels to PPMV/CP lay-friendly wording
-- Approved by clinical team (Tahi / Tamatula via ECHO group chat).
-- Replaces clinical terminology with plain-language descriptions
-- that are accessible to Primary/Patent Medicine Vendors and Community Pharmacists.
--
-- Labels left unchanged:
--   ACUTE_WATERY_DIARRHOEA  — no PPMV mapping provided
--   COUGH_OVER_TWO_WEEKS    — no PPMV mapping provided
--   OTHER_PRIORITY          — generic catch-all, no change needed

update public.syndromes
set
  label_en = 'Fever + skin rash + cough, runny nose or red eyes',
  label_ha = 'Zazzabi da kurji da tari, majina ko jan idanu'
where code = 'FEVER_RASH';

update public.syndromes
set
  label_en = 'Fever + bleeding without a clear reason',
  label_ha = 'Zazzabi da zubar jini ba tare da dalilin da ya bayyana ba'
where code = 'FEVER_BLEEDING';

update public.syndromes
set
  label_en = 'Fever + stiff neck or swollen/bulging soft spot on baby''s head',
  label_ha = 'Zazzabi da taurin wuya ko kumburi a kan jariri'
where code = 'FEVER_NECK_STIFFNESS';

update public.syndromes
set
  label_en = 'Cough + difficulty breathing or breathing unusually',
  label_ha = 'Tari da wahalar numfashi ko numfashi ba bisa ka''ida ba'
where code = 'ACUTE_RESPIRATORY_ILLNESS';

update public.syndromes
set
  label_en = 'Fever + yellow eyes or yellow skin',
  label_ha = 'Zazzabi da rawaya a idanu ko fata'
where code = 'JAUNDICE';

update public.syndromes
set
  label_en = 'Newborn unable to breastfeed/suck + stiff body or repeated jerking/spasms',
  label_ha = 'Jariri da ba ya iya shayarwa/miye + taurin jiki ko girgiza jiki'
where code = 'NEONATAL_DANGER_SIGNS';

update public.syndromes
set
  label_en = 'Sudden weakness or limpness in arms or legs',
  label_ha = 'Rauni ko naushi da ba zato ba a hannaye ko ƙafafu'
where code = 'ACUTE_FLACCID_PARALYSIS';
