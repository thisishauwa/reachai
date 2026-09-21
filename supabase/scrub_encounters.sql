-- ====================================================================
-- SCRUB ALL ENCOUNTERS & ALLOW CLEAN DELETIONS
-- Run this in Supabase SQL Editor
-- ====================================================================

-- 1. Update the immutability trigger function so that DELETE is allowed
-- (Completed encounters remain strictly immutable to INSERT/UPDATE tampering,
-- but can be deleted during encounter removal or scrubbing).
create or replace function private.require_open_encounter()
returns trigger language plpgsql set search_path = public as $$
declare payload jsonb;
declare eid uuid;
begin
  -- Allow if session_replication_role is replica
  if current_setting('session_replication_role', true) = 'replica' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Allow DELETE so encounters can be deleted/scrubbed
  if tg_op = 'DELETE' then
    return old;
  end if;

  payload := to_jsonb(new);
  eid := (payload ->> tg_argv[0])::uuid;
  if exists (select 1 from public.encounters e where e.id = eid and e.status = 'completed') then
    raise exception 'Completed encounter data is immutable';
  end if;
  return new;
end $$;

-- 2. Temporarily set replica mode to guarantee no trigger conflicts during mass scrub
set session_replication_role = replica;

-- 3. Scrub all encounters and child tables
delete from public.referral_events;
delete from public.referrals;
delete from public.triage_outcomes;
delete from public.encounter_lab_results;
delete from public.encounter_lab_tests;
delete from public.prescriptions;
delete from public.treatment_plans;
delete from public.encounter_diagnoses;
delete from public.clinical_notes;
delete from public.encounter_answers;
delete from public.encounter_syndromes;
delete from public.consents;
delete from public.encounter_demographics;
delete from public.encounters;

-- Restore normal trigger mode
set session_replication_role = origin;

-- 4. Allow facility members / clinicians to delete encounters
drop policy if exists encounters_member_delete on public.encounters;
create policy encounters_member_delete on public.encounters for delete
using (private.is_facility_member(facility_id));

-- 5. Security-definer RPC to delete a specific encounter cleanly from the app
create or replace function public.delete_encounter(p_encounter_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  set local session_replication_role = replica;
  delete from public.referral_events where referral_id in (select id from public.referrals where encounter_id = p_encounter_id);
  delete from public.referrals where encounter_id = p_encounter_id;
  delete from public.triage_outcomes where encounter_id = p_encounter_id;
  delete from public.encounter_lab_results where encounter_lab_test_id in (select id from public.encounter_lab_tests where encounter_id = p_encounter_id);
  delete from public.encounter_lab_tests where encounter_id = p_encounter_id;
  delete from public.prescriptions where encounter_id = p_encounter_id;
  delete from public.treatment_plans where encounter_id = p_encounter_id;
  delete from public.encounter_diagnoses where encounter_id = p_encounter_id;
  delete from public.clinical_notes where encounter_id = p_encounter_id;
  delete from public.encounter_answers where encounter_id = p_encounter_id;
  delete from public.encounter_syndromes where encounter_id = p_encounter_id;
  delete from public.consents where encounter_id = p_encounter_id;
  delete from public.encounter_demographics where encounter_id = p_encounter_id;
  delete from public.encounters where id = p_encounter_id;
  set local session_replication_role = origin;
end;
$$;
grant execute on function public.delete_encounter(uuid) to authenticated;

-- 6. Security-definer RPC to clear all encounters
create or replace function public.clear_all_encounters()
returns void language plpgsql security definer set search_path = public as $$
begin
  set local session_replication_role = replica;
  delete from public.referral_events;
  delete from public.referrals;
  delete from public.triage_outcomes;
  delete from public.encounter_lab_results;
  delete from public.encounter_lab_tests;
  delete from public.prescriptions;
  delete from public.treatment_plans;
  delete from public.encounter_diagnoses;
  delete from public.clinical_notes;
  delete from public.encounter_answers;
  delete from public.encounter_syndromes;
  delete from public.consents;
  delete from public.encounter_demographics;
  delete from public.encounters;
  set local session_replication_role = origin;
end;
$$;
grant execute on function public.clear_all_encounters() to authenticated;
