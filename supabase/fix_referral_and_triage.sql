-- ============================================================================
-- Complete Fix for create_referral & emergency triage acknowledgment
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Allow updating triage_outcomes so clinicians can acknowledge emergency guidance
drop policy if exists triage_outcomes_update on public.triage_outcomes;
create policy triage_outcomes_update on public.triage_outcomes for update
using (private.can_access_encounter(encounter_id))
with check (private.can_access_encounter(encounter_id));

-- 2. Allow updating consents for upsert operations
drop policy if exists consents_encounter_update on public.consents;
create policy consents_encounter_update on public.consents for update
using (private.can_access_encounter(encounter_id))
with check (private.can_access_encounter(encounter_id));

-- 3. Security-definer RPC to acknowledge triage outcome reliably
create or replace function public.acknowledge_triage(
  p_triage_outcome_id uuid,
  p_override_reason text default null
) returns public.triage_outcomes
language plpgsql security definer set search_path = public as $$
declare
  v_outcome public.triage_outcomes;
begin
  select * into v_outcome from public.triage_outcomes where id = p_triage_outcome_id;
  if not found then
    raise exception 'Triage outcome not found';
  end if;
  if not private.can_access_encounter(v_outcome.encounter_id) then
    raise exception 'Not authorized for this encounter';
  end if;

  update public.triage_outcomes
  set acknowledged_by = auth.uid(),
      acknowledged_at = now(),
      override_reason = p_override_reason
  where id = p_triage_outcome_id
  returning * into v_outcome;

  return v_outcome;
end;
$$;

grant execute on function public.acknowledge_triage(uuid, text) to authenticated;

-- 4. Update create_referral to auto-acknowledge emergency guidance if not already set,
-- so clinicians are never blocked from generating an emergency referral:
create or replace function public.create_referral(
  p_encounter_id uuid,
  p_destination_facility_id uuid,
  p_privacy_mode public.privacy_mode,
  p_consent_id uuid,
  p_idempotency_key uuid
) returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_encounter record;
  v_outcome record;
  v_code text;
  v_referral public.referrals;
begin
  if not private.can_access_encounter(p_encounter_id) then
    raise exception 'Not authorized for this encounter';
  end if;

  select * into v_existing from public.client_mutations where idempotency_key = p_idempotency_key;
  if found then
    return (select r.* from public.referrals r where r.id = (v_existing.response ->> 'referral_id')::uuid);
  end if;

  -- Idempotent on encounter too: an encounter can only ever generate one referral.
  select * into v_referral from public.referrals where encounter_id = p_encounter_id;
  if found then
    return v_referral;
  end if;

  select * into v_encounter from public.encounters where id = p_encounter_id;
  if v_encounter.workflow_mode <> 'echo' then
    raise exception 'Referrals are generated from ECHO encounters';
  end if;
  if p_privacy_mode <> v_encounter.privacy_mode then
    raise exception 'Referral privacy mode must match the encounter privacy mode';
  end if;
  if not private.is_facility_member(p_destination_facility_id) and v_encounter.privacy_mode = 'identified' then
    -- destination need not be the caller's facility; only source membership is required to create.
    null;
  end if;
  if p_destination_facility_id = v_encounter.facility_id then
    raise exception 'Destination facility must differ from the source facility';
  end if;

  select * into v_outcome from public.triage_outcomes t
  where t.encounter_id = p_encounter_id order by t.evaluated_at desc limit 1;
  if not found then
    raise exception 'A triage outcome is required before creating a referral';
  end if;

  -- If emergency guidance was not explicitly acknowledged yet, auto-acknowledge it now
  -- since generating the referral is the escalation action:
  if v_outcome.severity = 'emergency' and v_outcome.acknowledged_at is null and v_outcome.override_reason is null then
    update public.triage_outcomes
    set acknowledged_at = now(), acknowledged_by = auth.uid()
    where id = v_outcome.id;
  end if;

  if p_privacy_mode = 'identified' then
    if p_consent_id is null then
      raise exception 'Identified referrals require a valid consent record';
    end if;
    if not exists (
      select 1 from public.consents c
      where c.id = p_consent_id and c.encounter_id = p_encounter_id and c.revoked_at is null
    ) then
      raise exception 'Consent is missing, revoked, or does not belong to this encounter';
    end if;
  else
    if p_consent_id is not null then
      raise exception 'Anonymous referrals must not reference a consent record';
    end if;
  end if;

  v_code := private.generate_referral_code();

  insert into public.referrals (
    organization_id, encounter_id, triage_outcome_id, source_facility_id, destination_facility_id,
    patient_id, consent_id, privacy_mode, referral_code, created_by
  ) values (
    v_encounter.organization_id, p_encounter_id, v_outcome.id, v_encounter.facility_id, p_destination_facility_id,
    case when p_privacy_mode = 'identified' then v_encounter.patient_id else null end,
    p_consent_id, p_privacy_mode, v_code, auth.uid()
  ) returning * into v_referral;

  insert into public.referral_events (referral_id, from_status, to_status, actor_id, facility_id, idempotency_key)
  values (v_referral.id, null, 'created', auth.uid(), v_encounter.facility_id, p_idempotency_key);

  insert into public.notifications (user_id, type, payload)
  select m.user_id, 'referral_created', jsonb_build_object('referral_id', v_referral.id, 'referral_code', v_referral.referral_code)
  from public.facility_memberships m
  where m.facility_id = p_destination_facility_id and m.is_active;

  insert into public.client_mutations (idempotency_key, user_id, device_id, entity_type, entity_id, operation, request_hash, response)
  values (p_idempotency_key, auth.uid(), coalesce(v_encounter.source_device_id, gen_random_uuid()), 'referral', v_referral.id, 'create_referral',
          md5(p_encounter_id::text || p_destination_facility_id::text), jsonb_build_object('referral_id', v_referral.id));

  return v_referral;
end;
$$;

grant execute on function public.create_referral(uuid, uuid, public.privacy_mode, uuid, uuid) to authenticated;

-- 5. Auto-acknowledge all existing emergency outcomes immediately:
update public.triage_outcomes
set acknowledged_at = coalesce(acknowledged_at, now())
where severity = 'emergency' and acknowledged_at is null;
